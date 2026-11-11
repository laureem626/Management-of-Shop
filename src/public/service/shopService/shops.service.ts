import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
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

    await queryRunner.connect();
    await queryRunner.startTransaction();

    const schemaName = `shop_${randomUUID().replace(/-/g, '')}`;

    try {
      // 1. Verify user
      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found.');
      }

      // 2. Check duplicate shop code
      const existingShop = await queryRunner.manager.findOne(Shop, {
        where: { code: dto.code },
      });

      if (existingShop) {
        throw new BadRequestException(
          'Shop code already exists.',
        );
      }

      // 3. Create shop
      const shop = queryRunner.manager.create(Shop, {
        name: dto.name,
        code: dto.code.toUpperCase(),
        schemaName,
        isActive: true,
      });

      const savedShop = await queryRunner.manager.save(
        Shop,
        shop,
      );

      // 4. Create PostgreSQL schema
      await queryRunner.createSchema(schemaName, true);

      // 5. Assign user as OWNER
      const membership = queryRunner.manager.create(TenantUser, {
        userId: user.id,
        shopId: savedShop.id,
        role: TenantUserRole.OWNER,
        isActive: true,
      });

      await queryRunner.manager.save(TenantUser, membership);

      await queryRunner.commitTransaction();

      return {
        message: 'Shop created successfully.',
        data: savedShop,
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
        error instanceof Error ? error.message : 'An unexpected error occurred.',
      );
    } finally {
      await queryRunner.release();
    }
  }

  async findAll() {
    return this.shopRepository.find({
      where: { isActive: true },
    });
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