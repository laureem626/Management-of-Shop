import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

import { AuthGuard } from '@nestjs/passport';

import { ItemsService } from '../service/items.service';
import { CreateItemDto } from '../dto/create-item.dto';
import { UpdateItemDto } from '../dto/update-item.dto';
import { TenantMigrationService } from '../../tenants/service/tenants-service';
import { JwtAuthGuard } from '../../auth/Guard/jwt-auth.guard';

interface AuthenticatedRequest {
  user: {
    id: number;
    shopId: number;
  };
}

@ApiTags('Shop Items')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('shops/:shopId/items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Post()
  @ApiOperation({ summary: 'Create an item in a shop' })
  create(
    @Param('shopId', ParseIntPipe) shopId: number,
    @Body() dto: CreateItemDto,
    @Req() req: any,
  ) {
    return this.itemsService.create(
      shopId,
      dto,
      req.user.id,
    );
  }

  @Get()
@ApiOperation({ summary: 'Get all items for the logged-in user shop' })
@ApiResponse({
  status: 200,
  description: 'Items retrieved successfully.',
})
async findAll(@Request() req: AuthenticatedRequest) {
  return this.itemsService.findAll(
    req.user.shopId,
    req.user.id,
  );
}

  @Get(':uuid')
  @ApiOperation({ summary: 'Get an item by UUID' })
  findOneByUuid(
    @Param('shopId', ParseIntPipe) shopId: number,
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Req() req: any,
  ) {
    return this.itemsService.findOneByUuid(
      shopId,
      uuid,
      req.user.id,
    );
  }

  @Patch(':uuid')
  @ApiOperation({ summary: 'Update an item' })
  update(
    @Param('shopId', ParseIntPipe) shopId: number,
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: UpdateItemDto,
    @Req() req: any,
  ) {
    return this.itemsService.update(
      shopId,
      uuid,
      dto,
      req.user.id,
    );
  }

  @Delete(':uuid')
  @ApiOperation({ summary: 'Deactivate an item' })
  remove(
    @Param('shopId', ParseIntPipe) shopId: number,
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Req() req: any,
  ) {
    return this.itemsService.remove(
      shopId,
      uuid,
      req.user.id,
    );
  }
}