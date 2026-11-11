import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shop } from './entity/shop.entity';
import { TenantUser } from './entity/tenant-user.entity';
import { User } from './entity/users.entity';
import { ShopsController } from './controller/shopsController/shops.conroller';
import { ShopsService } from './service/shopService/shops.service';


@Module({
  imports: [
    TypeOrmModule.forFeature([
      Shop,
      TenantUser,
      User,
    ]),
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