import {
  IsString,
  IsNotEmpty,
  ValidateNested,
} from 'class-validator';

import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

import { CreateShopAdminDto } from './create-shop-admin.dto';

export class CreateShopDto {
  @ApiProperty({
    example: 'Laureen Shopping Centre',
    description: 'Name of the shop',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'LSC001',
    description: 'Unique shop code',
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    type: () => CreateShopAdminDto,
    description: 'Administrator details for the new shop',
  })
  @ValidateNested()
  @Type(() => CreateShopAdminDto)
  admin: CreateShopAdminDto;
}