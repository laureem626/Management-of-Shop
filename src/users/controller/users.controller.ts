import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

import { AuthGuard } from '@nestjs/passport';

import { UsersService } from '../service/users.service';
import { CreateUserDto } from '../dto/create-user.dto';

@ApiTags('Shop Users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('shops/:shopId/users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Register a user in a shop',
  })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully.',
  })
  create(
    @Param('shopId', ParseIntPipe) shopId: number,
    @Body() dto: CreateUserDto,
    @Req() req: any,
  ) {
    return this.usersService.create(
      shopId,
      dto,
      req.user.id,
    );
  }

  @Get()
findAll(
  @Param('shopId', ParseIntPipe) shopId: number,
  @Req() req: any,
) {
  return this.usersService.findAll(shopId, req.user.id);
}

@Get(':uuid')
findOneByUuid(
  @Param('shopId', ParseIntPipe) shopId: number,
  @Param('uuid') uuid: string,
  @Req() req: any,
) {
  return this.usersService.findOneByUuid(
    shopId,
    uuid,
    req.user.id,
  );
}
}