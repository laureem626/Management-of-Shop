import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

import { DataSource, EntityManager } from 'typeorm';
import { Shop } from '../../shop/entity/shop.entity';
import { TenantUser, TenantUserRole } from '../../tenants/entity/tenant-user.entity';
import { CreateItemDto } from '../dto/create-item.dto';
import { UpdateItemDto } from '../dto/update-item.dto';





@Injectable()
export class ItemsService {
  constructor(private readonly dataSource: DataSource) {}

  // Verify shop and logged-in user's membership
  private async getShopAccess(
    manager: EntityManager,
    shopId: number,
    userId: number,
  ) {
    const shop = await manager.findOne(Shop, {
      where: {
        id: shopId,
        isActive: true,
      },
    });

    if (!shop) {
      throw new NotFoundException('Shop not found or inactive.');
    }

    if (!/^shop_[a-f0-9]{32}$/.test(shop.schemaName)) {
      throw new BadRequestException(
        'Invalid shop schema configuration.',
      );
    }

    const membership = await manager.findOne(TenantUser, {
      where: {
        shopId,
        userId,
        isActive: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'You do not belong to this shop.',
      );
    }

    return {
      shop,
      schema: `"${shop.schemaName}"`,
      membership,
    };
  }

  // Only OWNER, ADMIN and MANAGER can create or update items
  private checkManagePermission(role: TenantUserRole) {
    const allowedRoles = [
      TenantUserRole.OWNER,
      TenantUserRole.ADMIN,
      TenantUserRole.MANAGER,
    ];

    if (!allowedRoles.includes(role)) {
      throw new ForbiddenException(
        'You do not have permission to manage items.',
      );
    }


  }

  async create(
  shopId: number,
  dto: CreateItemDto,
  loggedInUserId: number,
) {
  const queryRunner = this.dataSource.createQueryRunner();

  try {
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const { schema, membership } = await this.getShopAccess(
      queryRunner.manager,
      shopId,
      loggedInUserId,
    );

    this.checkManagePermission(membership.role);

    const result = await queryRunner.query(
      `
        INSERT INTO ${schema}."items"
        (
          "name",
          "description",
          "price",
          "quantity"
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [
        dto.name.trim(),
        dto.description?.trim() || null,
        dto.price,
        dto.quantity,
      ],
    );

    await queryRunner.commitTransaction();

    return {
      message: 'Item created successfully.',
      data: result[0],
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

    console.error('Create item error:', error);

    throw new BadRequestException('Failed to create item.');
  } finally {
    await queryRunner.release();
  }
}

async findAll(
  shopId: number,
  loggedInUserId: number,
) {
  const { schema } = await this.getShopAccess(
    this.dataSource.manager,
    shopId,
    loggedInUserId,
  );

  const items = await this.dataSource.query(
    `
      SELECT *
      FROM ${schema}."items"
      WHERE "isActive" = TRUE
      ORDER BY "id" DESC
    `,
  );

  return {
    message: 'Items retrieved successfully.',
    data: items,
  };
}

async findOneByUuid(
  shopId: number,
  uuid: string,
  loggedInUserId: number,
) {
  const { schema } = await this.getShopAccess(
    this.dataSource.manager,
    shopId,
    loggedInUserId,
  );

  const items = await this.dataSource.query(
    `
      SELECT *
      FROM ${schema}."items"
      WHERE "uuid" = $1
        AND "isActive" = TRUE
      LIMIT 1
    `,
    [uuid],
  );

  if (items.length === 0) {
    throw new NotFoundException('Item not found in this shop.');
  }

  return {
    message: 'Item retrieved successfully.',
    data: items[0],
  };
}

async update(
  shopId: number,
  uuid: string,
  dto: UpdateItemDto,
  loggedInUserId: number,
) {
  const queryRunner = this.dataSource.createQueryRunner();

  try {
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const { schema, membership } = await this.getShopAccess(
      queryRunner.manager,
      shopId,
      loggedInUserId,
    );

    this.checkManagePermission(membership.role);

    const existing = await queryRunner.query(
      `
        SELECT "id"
        FROM ${schema}."items"
        WHERE "uuid" = $1
          AND "isActive" = TRUE
        LIMIT 1
      `,
      [uuid],
    );

    if (existing.length === 0) {
      throw new NotFoundException('Item not found.');
    }

    const fields: string[] = [];
    const values: any[] = [];

    const addField = (column: string, value: any) => {
      values.push(value);
      fields.push(`"${column}" = $${values.length}`);
    };

    if (dto.name !== undefined) {
      addField('name', dto.name.trim());
    }

    if (dto.description !== undefined) {
      addField(
        'description',
        dto.description?.trim() || null,
      );
    }

    if (dto.price !== undefined) {
      addField('price', dto.price);
    }

    if (dto.quantity !== undefined) {
      addField('quantity', dto.quantity);
    }

    if (fields.length === 0) {
      throw new BadRequestException(
        'Provide at least one field to update.',
      );
    }

    fields.push('"updatedAt" = CURRENT_TIMESTAMP');
    values.push(uuid);

    const result = await queryRunner.query(
      `
        UPDATE ${schema}."items"
        SET ${fields.join(', ')}
        WHERE "uuid" = $${values.length}
          AND "isActive" = TRUE
        RETURNING *
      `,
      values,
    );

    await queryRunner.commitTransaction();

    return {
      message: 'Item updated successfully.',
      data: result[0],
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

    console.error('Update item error:', error);

    throw new BadRequestException('Failed to update item.');
  } finally {
    await queryRunner.release();
  }
}

async remove(
  shopId: number,
  uuid: string,
  loggedInUserId: number,
) {
  const queryRunner = this.dataSource.createQueryRunner();

  try {
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const { schema, membership } = await this.getShopAccess(
      queryRunner.manager,
      shopId,
      loggedInUserId,
    );

    this.checkManagePermission(membership.role);

    const result = await queryRunner.query(
      `
        UPDATE ${schema}."items"
        SET "isActive" = FALSE,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "uuid" = $1
          AND "isActive" = TRUE
        RETURNING *
      `,
      [uuid],
    );

    if (result.length === 0) {
      throw new NotFoundException('Item not found.');
    }

    await queryRunner.commitTransaction();

    return {
      message: 'Item deactivated successfully.',
      data: result[0],
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

    console.error('Deactivate item error:', error);

    throw new BadRequestException('Failed to deactivate item.');
  } finally {
    await queryRunner.release();
  }
}
}