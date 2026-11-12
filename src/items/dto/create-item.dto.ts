import {
  IsDecimal,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

export class CreateItemDto {
  @ApiProperty({
    description: 'Name of the item',
    example: 'HP Laptop',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({
    description: 'Description of the item',
    example: 'HP Core i5 laptop, 8GB RAM, 512GB SSD',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Selling price of the item',
    example: '1500000.00',
    type: String,
  })
  @IsDecimal({ decimal_digits: '0,2' })
  price: string;

  @ApiProperty({
    description: 'Available quantity of the item',
    example: '10.00',
    type: String,
  })
  @IsDecimal({ decimal_digits: '0,2' })
  quantity: string;
}