import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Req,
} from '@nestjs/common';

import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { LoginDto } from '../dto/login.dto';
import { JwtAuthGuard } from '../Guard/jwt-auth.guard';
import { AuthService } from '../service/auth.service';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  // PUBLIC LOGIN
  @Post('login')
  @ApiOperation({ summary: 'Login user and generate JWT token' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  // PROTECTED USER PROFILE
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get authenticated user profile' })
  getProfile(@Req() req: any) {
    return {
      message: 'Authenticated successfully',
      user: req.user,
    };
  }
}