import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsOptional,
  IsInt,
  Min,
} from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Registered user email',
    example: 'admin@gmail.com',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'Admin@123',
    minLength: 6,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({
    description: 'Shop ID. Required when the user belongs to multiple shops.',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  shopId?: number;
}