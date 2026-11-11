import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';

import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

import { CreateShopDto } from '../../dto/create-shop.dto';
import { ShopsService } from '../../service/shopService/shops.service';

@ApiTags('Shops')
@ApiBearerAuth()
@Controller('shops')
export class ShopsController {
  constructor(
    private readonly shopsService: ShopsService,
  ) {}

  // CREATE SHOP
  @Post()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Register a new shop',
    description: 'Only superadmins can register new shops.',
  })
  @ApiResponse({
    status: 201,
    description: 'Shop created successfully.',
  })
  @ApiResponse({
    status: 403,
    description: 'Only superadmins can create shops.',
  })
  async create(
    @Body() createShopDto: CreateShopDto,
    @Req() req: any,
  ) {
    if (!req.user?.isSuperAdmin) {
      throw new ForbiddenException(
        'Only superadmins can create shops.',
      );
    }

    return this.shopsService.create(
      createShopDto,
      req.user.id,
    );
  }

  // GET ALL SHOPS
  @Get()
  @ApiOperation({
    summary: 'Get all active shops',
  })
  @ApiResponse({
    status: 200,
    description: 'Shops retrieved successfully.',
  })
  findAll() {
    return this.shopsService.findAll();
  }

  // GET SINGLE SHOP
  @Get(':id')
  @ApiOperation({
    summary: 'Get shop by ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Shop retrieved successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'Shop not found.',
  })
  findOne(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.shopsService.findOne(id);
  }
}