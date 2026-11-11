import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { User } from '../../public/entity/users.entity';
import { LoginDto } from '../dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // 1. Find user and retrieve password
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .leftJoinAndSelect('user.shops', 'tenantUser')
      .leftJoinAndSelect('tenantUser.shop', 'shop')
      .where('LOWER(user.email) = LOWER(:email)', { email })
      .getOne();

    if (!user) {
      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    // 2. Check whether user is active
    if (!user.isActive) {
      throw new UnauthorizedException(
        'Your account is inactive',
      );
    }

    // 3. Verify password
    const passwordMatch = await bcrypt.compare(
      password,
      user.password,
    );

    if (!passwordMatch) {
      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    // 4. Generate JWT payload
    const payload = {
      sub: user.id,
      uuid: user.uuid,
      email: user.email,
    };

    // 5. Generate access token
    const accessToken = await this.jwtService.signAsync(
      payload,
    );

    // 6. Retrieve active shops belonging to user
    const shops = (user.shops || [])
      .filter(
        (membership) =>
          membership.isActive &&
          membership.shop?.isActive,
      )
      .map((membership) => ({
        id: membership.shop.id,
        uuid: membership.shop.uuid,
        name: membership.shop.name,
        code: membership.shop.code,
        role: membership.role,
      }));

    // 7. Return response
    return {
      message: 'Login successful',

      accessToken,

      tokenType: 'Bearer',

      user: {
        id: user.id,
        uuid: user.uuid,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        profileImage: user.profileImage,
      },

      shops,
    };
  }
}