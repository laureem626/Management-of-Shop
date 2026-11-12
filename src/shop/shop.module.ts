import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shop } from './entity/shop.entity';
import { TenantUser } from '../tenants/entity/tenant-user.entity';
import { User } from '../users/entity/users.entity';
import { ShopsController } from './controller/shopsController/shops.conroller';
import { ShopsService } from './service/shopService/shops.service';
import { TenantsModule } from '../tenants/tenants.module';


@Module({
  imports: [
    TypeOrmModule.forFeature([
      Shop,
      TenantUser,
      User,
    ]),
    TenantsModule,
  ],

  controllers: [
    ShopsController,
  ],

  providers: [
    ShopsService,
  ],

  exports: [
    ShopsService,
  ],
})
export class PublicModule {}