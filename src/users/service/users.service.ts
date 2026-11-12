import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';

import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '../dto/create-user.dto';
import { TenantUser, TenantUserRole } from '../../tenants/entity/tenant-user.entity';
import { Shop } from '../../shop/entity/shop.entity';
import { User } from '../entity/users.entity';



@Injectable()
export class UsersService {
  constructor(
    private readonly dataSource: DataSource,
  ) {}

  // ==========================================
  // REGISTER USER IN A SHOP
  // ==========================================

  async create(
    shopId: number,
    dto: CreateUserDto,
    loggedInUserId: number,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      // 1. Find the logged-in administrator
      const loggedInUser = await queryRunner.manager.findOne(User, {
        where: {
          id: loggedInUserId,
          isActive: true,
        },
      });

      if (!loggedInUser) {
        throw new NotFoundException(
          'Logged-in user not found or inactive.',
        );
      }

      // 2. Find the shop
      const shop = await queryRunner.manager.findOne(Shop, {
        where: {
          id: shopId,
          isActive: true,
        },
      });

      if (!shop) {
        throw new NotFoundException('Shop not found or inactive.');
      }

      // 3. Verify administrator membership
      const adminMembership = await queryRunner.manager.findOne(
        TenantUser,
        {
          where: {
            userId: loggedInUser.id,
            shopId: shop.id,
            isActive: true,
          },
        },
      );

      if (!adminMembership) {
        throw new ForbiddenException(
          'You do not belong to this shop.',
        );
      }

      // 4. Only OWNER and ADMIN can register users
      if (
        adminMembership.role !== TenantUserRole.ADMIN &&
        adminMembership.role !== TenantUserRole.OWNER
      ) {
        throw new ForbiddenException(
          'Only shop administrators can register users.',
        );
      }

      // 5. Validate requested role
      const role = dto.role || TenantUserRole.STAFF;

      const allowedRoles = [
        TenantUserRole.MANAGER,
        TenantUserRole.CASHIER,
        TenantUserRole.STAFF,
      ];

      if (!allowedRoles.includes(role)) {
        throw new BadRequestException(
          'You cannot assign the OWNER or ADMIN role.',
        );
      }

      // 6. Normalize email
      const email = dto.email.trim().toLowerCase();

      // 7. Find existing public user, including password
      const existingUser = await queryRunner.manager
        .createQueryBuilder(User, 'user')
        .addSelect('user.password')
        .where('LOWER(user.email) = :email', { email })
        .getOne();

      let savedUser: User;
      let hashedPassword: string;

      if (existingUser) {
        if (!existingUser.isActive) {
          throw new BadRequestException(
            'This user account is ieyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjQsImlkIjo0LCJ1dWlkIjoiOGJjNjhhMmQtNGYzOC00YmM0LWE2ODItY2U1NzkxYjZjOWU3IiwiZW1haWwiOiJqb0Bqb2huLmNvbSIsImlzU3VwZXJBZG1pbiI6ZmFsc2UsInNob3BJZCI6Nywic2hvcFV1aWQiOiJlNmQzMDA5OS0yODM5LTQ3MGMtODkyZC04OTMyNWY3NGNkYTUiLCJzY2hlbWFOYW1lIjoic2hvcF80YjRmOGZmOWVjYzI0NWZjODM3YzFlZmRkMWQ4ZGMxYyIsInRlbmFudFVzZXJJZCI6Nywicm9sZSI6IkFkbWluIiwiaWF0IjoxNzk0NDY3MTA4fQ.NPnwVSMW5HxPpdnqI3p9fpAmFYFO_BPmNSFzmy5nQgonactive.',
          );
        }

        savedUser = existingUser;
        hashedPassword = existingUser.password;

        // Existing user must not already belong to this shop
        const existingMembership =
          await queryRunner.manager.findOne(TenantUser, {
            where: {
              userId: existingUser.id,
              shopId: shop.id,
            },
          });

        if (existingMembership) {
          throw new BadRequestException(
            'This user already belongs to this shop.',
          );
        }
      } else {
        // 8. Hash password for a new user
        hashedPassword = await bcrypt.hash(dto.password, 10);

        // 9. Create user in public.users
        const newUser = queryRunner.manager.create(User, {
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          email,
          phoneNumber: dto.phoneNumber?.trim() || null,
          password: hashedPassword,
          isActive: true,
          isVerified: false,
          isSuperAdmin: false,
        });

        savedUser = await queryRunner.manager.save(
          User,
          newUser,
        );
      }

      // 10. Assign user to the shop in public.tenant_users
      const membership = queryRunner.manager.create(TenantUser, {
        userId: savedUser.id,
        shopId: shop.id,
        role,
        isActive: true,
      });

      await queryRunner.manager.save(
        TenantUser,
        membership,
      );

      // 11. Validate tenant schema name
      if (!/^shop_[a-f0-9]{32}$/.test(shop.schemaName)) {
        throw new BadRequestException(
          'Invalid shop schema configuration.',
        );
      }

      const schema = `"${shop.schemaName}"`;

      // 12. Check if user already exists in tenant.users
      const tenantUsers = await queryRunner.query(
        `
          SELECT "id"
          FROM ${schema}."users"
          WHERE "email" = $1
          LIMIT 1
        `,
        [email],
      );

      if (tenantUsers.length > 0) {
        throw new BadRequestException(
          'This user already exists in the shop database.',
        );
      }

      // 13. Insert user into the shop's users table
      await queryRunner.query(
        `
          INSERT INTO ${schema}."users"
          (
            "uuid",
            "firstName",
            "lastName",
            "email",
            "phoneNumber",
            "password",
            "isActive",
            "isVerified",
            "isSuperAdmin"
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          savedUser.uuid,
          savedUser.firstName,
          savedUser.lastName,
          savedUser.email,
          savedUser.phoneNumber || null,
          hashedPassword,
          savedUser.isActive,
          savedUser.isVerified,
          false,
        ],
      );

      // 14. Commit transaction
      await queryRunner.commitTransaction();

      return {
        message: 'User registered successfully in the shop.',
        data: {
          id: savedUser.id,
          uuid: savedUser.uuid,
          firstName: savedUser.firstName,
          lastName: savedUser.lastName,
          email: savedUser.email,
          phoneNumber: savedUser.phoneNumber,
          shop: {
            id: shop.id,
            name: shop.name,
            code: shop.code,
          },
          role,
        },
      };
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      console.error('Register shop user error:', error);

      throw new InternalServerErrorException(
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred.',
      );
    } finally {
      await queryRunner.release();
    }
  }

async findAll(shopId: number, loggedInUserId: number) {
  // 1. Check shop
  const shop = await this.dataSource.manager.findOne(Shop, {
    where: {
      id: shopId,
      isActive: true,
    },
  });

  if (!shop) {
    throw new NotFoundException('Shop not found or inactive.');
  }

  // 2. Check logged-in user's membership
  const adminMembership = await this.dataSource.manager.findOne(
    TenantUser,
    {
      where: {
        userId: loggedInUserId,
        shopId,
        isActive: true,
      },
    },
  );

  if (!adminMembership) {
    throw new ForbiddenException(
      'You do not belong to this shop.',
    );
  }

  // 3. Only OWNER and ADMIN can view users
  if (
    adminMembership.role !== TenantUserRole.ADMIN &&
    adminMembership.role !== TenantUserRole.OWNER
  ) {
    throw new ForbiddenException(
      'Only shop administrators can view users.',
    );
  }

  // 4. Get all active users belonging to this shop
  const memberships = await this.dataSource.manager.find(
    TenantUser,
    {
      where: {
        shopId,
        isActive: true,
        user: {
          isActive: true,
        },
      },
      relations: {
        user: true,
      },
      order: {
        id: 'DESC',
      },
    },
  );

  return {
    message: 'Shop users retrieved successfully.',
    data: memberships.map((membership) => ({
      id: membership.user.id,
      uuid: membership.user.uuid,
      firstName: membership.user.firstName,
      lastName: membership.user.lastName,
      email: membership.user.email,
      phoneNumber: membership.user.phoneNumber,
      isActive: membership.user.isActive,
      role: membership.role,
      membershipId: membership.id,
      createdAt: membership.user.createdAt,
    })),
  };
}
 async findOneByUuid(
  shopId: number,
  uuid: string,
  loggedInUserId: number,
) {
  // 1. Check shop
  const shop = await this.dataSource.manager.findOne(Shop, {
    where: {
      id: shopId,
      isActive: true,
    },
  });

  if (!shop) {
    throw new NotFoundException('Shop not found or inactive.');
  }

  // 2. Verify administrator membership
  const adminMembership = await this.dataSource.manager.findOne(
    TenantUser,
    {
      where: {
        userId: loggedInUserId,
        shopId,
        isActive: true,
      },
    },
  );

  if (!adminMembership) {
    throw new ForbiddenException(
      'You do not belong to this shop.',
    );
  }

  // 3. Only OWNER and ADMIN can view users
  if (
    adminMembership.role !== TenantUserRole.ADMIN &&
    adminMembership.role !== TenantUserRole.OWNER
  ) {
    throw new ForbiddenException(
      'Only shop administrators can view users.',
    );
  }

  // 4. Find user belonging to this shop
  const membership = await this.dataSource.manager.findOne(
    TenantUser,
    {
      where: {
        shopId,
        isActive: true,
        user: {
          uuid,
          isActive: true,
        },
      },
      relations: {
        user: true,
      },
    },
  );

  if (!membership) {
    throw new NotFoundException(
      'User not found in this shop.',
    );
  }

  return {
    message: 'User retrieved successfully.',
    data: {
      id: membership.user.id,
      uuid: membership.user.uuid,
      firstName: membership.user.firstName,
      lastName: membership.user.lastName,
      email: membership.user.email,
      phoneNumber: membership.user.phoneNumber,
      isActive: membership.user.isActive,
      isVerified: membership.user.isVerified,
      role: membership.role,
      membershipId: membership.id,
      shop: {
        id: shop.id,
        name: shop.name,
        code: shop.code,
      },
      createdAt: membership.user.createdAt,
      updatedAt: membership.user.updatedAt,
    },
  };
}

}