import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';

import { CreateShopDto } from '../../dto/create-shop.dto';

import { Shop } from '../../entity/shop.entity';
import { User } from '../../../users/entity/users.entity';

import {
  TenantUser,
  TenantUserRole,
} from '../../../tenants/entity/tenant-user.entity';

import { TenantMigrationService } from '../../../tenants/service/tenants-service';

@Injectable()
export class ShopsService {
  constructor(
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(TenantUser)
    private readonly tenantUserRepository: Repository<TenantUser>,

    private readonly dataSource: DataSource,

    private readonly tenantMigrationService: TenantMigrationService,
  ) {}

  // =====================================================
  // CREATE SHOP
  // =====================================================

 
 async create(dto: CreateShopDto, userId: number) {
  const queryRunner = this.dataSource.createQueryRunner();

  const schemaName = `shop_${randomUUID().replace(/-/g, '')}`;

  try {
    await queryRunner.connect();
    await queryRunner.startTransaction();

    // 1. Verify logged-in user in public.users
    const loggedInUser = await queryRunner.manager.findOne(User, {
      where: { id: userId },
    });

    if (!loggedInUser) {
      throw new NotFoundException('Logged-in user not found.');
    }

    if (!loggedInUser.isActive) {
      throw new BadRequestException(
        'Your account is inactive.',
      );
    }

    // 2. Generate shop code automatically
    await queryRunner.query(`
      CREATE SEQUENCE IF NOT EXISTS public.shop_code_seq
      START WITH 1
      INCREMENT BY 1
    `);

    const sequenceResult = await queryRunner.query(`
      SELECT nextval('public.shop_code_seq') AS number
    `);

    const shopNumber = Number(sequenceResult[0].number);

    const shopCode = `Shop${String(shopNumber).padStart(4, '0')}`;

    // 3. Normalize administrator email
    const adminEmail = dto.admin.email.trim().toLowerCase();

    // 4. Check whether administrator email already exists
    const existingAdmin = await queryRunner.manager.findOne(User, {
      where: { email: adminEmail },
    });

    if (existingAdmin) {
      throw new BadRequestException(
        'A user with this administrator email already exists.',
      );
    }

    // 5. Create shop in public.shops
    const shop = queryRunner.manager.create(Shop, {
      name: dto.name.trim(),
      code: shopCode,
      schemaName,
      isActive: true,
    });

    const savedShop = await queryRunner.manager.save(
      Shop,
      shop,
    );

    // 6. Create PostgreSQL schema
    await queryRunner.createSchema(schemaName, true);

    // 7. Create all tenant tables
    await this.tenantMigrationService.runMigrations(
      queryRunner,
      schemaName,
      savedShop,
    );

    // 8. Assign logged-in user to the shop
    const loggedInUserMembership = queryRunner.manager.create(
      TenantUser,
      {
        userId: loggedInUser.id,
        shopId: savedShop.id,
        role: TenantUserRole.ADMIN,
        isActive: true,
      },
    );

    await queryRunner.manager.save(
      TenantUser,
      loggedInUserMembership,
    );

    // 9. Hash administrator password
    const hashedPassword = await bcrypt.hash(
      dto.admin.password,
      10,
    );

    // 10. Create administrator in public.users
    const admin = queryRunner.manager.create(User, {
      firstName: dto.admin.firstName.trim(),
      lastName: dto.admin.lastName.trim(),
      email: adminEmail,
      phoneNumber: dto.admin.phoneNumber || undefined,
      password: hashedPassword,
      isActive: true,
      isVerified: false,
    });

    const savedAdmin = await queryRunner.manager.save(
      User,
      admin,
    );

    // 11. Assign administrator to the shop
    const adminMembership = queryRunner.manager.create(
      TenantUser,
      {
        userId: savedAdmin.id,
        shopId: savedShop.id,
        role: TenantUserRole.ADMIN,
        isActive: true,
      },
    );

    await queryRunner.manager.save(
      TenantUser,
      adminMembership,
    );

    // 12. Also save administrator in tenant.users
    await queryRunner.query(
      `
        INSERT INTO "${schemaName}"."users"
        (
          "uuid",
          "firstName",
          "lastName",
          "email",
          "phoneNumber",
          "password",
          "isActive",
          "isVerified"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        savedAdmin.uuid,
        savedAdmin.firstName,
        savedAdmin.lastName,
        savedAdmin.email,
        savedAdmin.phoneNumber || null,
        hashedPassword,
        true,
        false,
      ],
    );

    // 13. Commit transaction
    await queryRunner.commitTransaction();

    // 14. Return response
    return {
      message: 'Shop and administrators created successfully.',
      data: {
        shop: {
          id: savedShop.id,
          uuid: savedShop.uuid,
          name: savedShop.name,
          code: savedShop.code,
          schemaName: savedShop.schemaName,
          isActive: savedShop.isActive,
        },

        administrators: [
          {
            id: savedAdmin.id,
            uuid: savedAdmin.uuid,
            firstName: savedAdmin.firstName,
            lastName: savedAdmin.lastName,
            email: savedAdmin.email,
            phoneNumber: savedAdmin.phoneNumber,
            role: TenantUserRole.ADMIN,
          },
        ],
      },
    };
  } catch (error) {
    // Roll back all changes if anything fails
    if (queryRunner.isTransactionActive) {
      await queryRunner.rollbackTransaction();
    }

    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException
    ) {
      throw error;
    }

    console.error('Create shop error:', error);

    throw new InternalServerErrorException(
      error instanceof Error
        ? error.message
        : 'An unexpected error occurred.',
    );
  } finally {
    await queryRunner.release();
  }
}

  // =====================================================
  // FIND ALL SHOPS
  // =====================================================

  async findAll() {
    const shops = await this.shopRepository.find({
      where: { isActive: true },

      relations: {
        tenantUsers: {
          user: true,
        },
      },

      order: {
        createdAt: 'DESC',
      },
    });

    return {
      message: 'Shops retrieved successfully.',

      data: shops.map((shop) => ({
        id: shop.id,
        uuid: shop.uuid,
        name: shop.name,
        code: shop.code,
        schemaName: shop.schemaName,
        isActive: shop.isActive,
        createdAt: shop.createdAt,

        administrators: shop.tenantUsers
          .filter(
            (membership) =>
              membership.isActive &&
              membership.role === TenantUserRole.ADMIN &&
              membership.user?.isActive,
          )
          .map((membership) => ({
            id: membership.user.id,
            firstName: membership.user.firstName,
            lastName: membership.user.lastName,
            email: membership.user.email,
            phoneNumber: membership.user.phoneNumber,
            role: membership.role,
          })),
      })),
    };
  }

  // =====================================================
  // FIND ONE SHOP
  // =====================================================

  async findOne(id: number) {
    const shop = await this.shopRepository.findOne({
      where: { id },

      relations: {
        tenantUsers: {
          user: true,
        },
      },
    });

    if (!shop) {
      throw new NotFoundException('Shop not found.');
    }

    return {
      message: 'Shop retrieved successfully.',
      data: shop,
    };
  }
}