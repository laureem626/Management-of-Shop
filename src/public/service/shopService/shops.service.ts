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
import { User } from '../../entity/users.entity';
import { TenantUser, TenantUserRole } from '../../entity/tenant-user.entity';


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
  ) {}

  async create(dto: CreateShopDto, userId: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    const schemaName = `shop_${randomUUID().replace(/-/g, '')}`;

    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      const loggedInUser = await queryRunner.manager.findOne(User, {
        where: { id: userId },
      });

      if (!loggedInUser) {
        throw new NotFoundException('User not found.');
      }

      const shopCode = dto.code.trim().toUpperCase();
      const existingShop = await queryRunner.manager.findOne(Shop, {
        where: { code: shopCode },
      });

      if (existingShop) {
        throw new BadRequestException('Shop code already exists.');
      }

      const existingAdmin = await queryRunner.manager.findOne(User, {
        where: { email: dto.admin.email },
      });

      if (existingAdmin) {
        throw new BadRequestException(
          'A user with this administrator email already exists.',
        );
      }

      const shop = queryRunner.manager.create(Shop, {
        name: dto.name,
        code: shopCode,
        schemaName,
        isActive: true,
      });
      const savedShop = await queryRunner.manager.save(Shop, shop);

      await queryRunner.createSchema(schemaName, true);

      const loggedInUserMembership = queryRunner.manager.create(TenantUser, {
        userId: loggedInUser.id,
        shopId: savedShop.id,
        role: TenantUserRole.ADMIN,
        isActive: true,
      });
      await queryRunner.manager.save(TenantUser, loggedInUserMembership);

      const hashedPassword = await bcrypt.hash(dto.admin.password, 10);
      const admin = queryRunner.manager.create(User, {
        firstName: dto.admin.firstName,
        lastName: dto.admin.lastName,
        email: dto.admin.email,
        phoneNumber: dto.admin.phoneNumber,
        password: hashedPassword,
        isActive: true,
        isVerified: false,
      });
      const savedAdmin = await queryRunner.manager.save(User, admin);

      const adminMembership = queryRunner.manager.create(TenantUser, {
        userId: savedAdmin.id,
        shopId: savedShop.id,
        role: TenantUserRole.ADMIN,
        isActive: true,
      });
      await queryRunner.manager.save(TenantUser, adminMembership);
      await queryRunner.commitTransaction();

      return {
        message: 'Shop and administrators created successfully.',
        data: {
          shop: savedShop,
          administrators: [
            {
              id: loggedInUser.id,
              firstName: loggedInUser.firstName,
              lastName: loggedInUser.lastName,
              email: loggedInUser.email,
              role: TenantUserRole.ADMIN,
            },
            {
              id: savedAdmin.id,
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
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred.',
      );
    } finally {
      await queryRunner.release();
    }
  }

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

  async findOne(id: number) {
    const shop = await this.shopRepository.findOne({
      where: { id },
    });

    if (!shop) {
      throw new NotFoundException('Shop not found.');
    }

    return shop;
  }
}