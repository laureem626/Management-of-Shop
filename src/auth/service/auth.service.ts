import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { User } from '../../public/entity/users.entity';
import { TenantUser } from '../../public/entity/tenant-user.entity';
import { LoginDto } from '../dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(TenantUser)
    private readonly tenantUserRepository: Repository<TenantUser>,

    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // 1. Find user and retrieve password
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('LOWER(user.email) = LOWER(:email)', { email })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    // 2. Check whether user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Your account is inactive.');
    }

    // 3. Verify password
    const passwordMatch = await bcrypt.compare(
      password,
      user.password,
    );

    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    let selectedShop: any = null;
    let selectedMembership: TenantUser | null = null;

    // 4. Automatically identify the user's shop
    if (!user.isSuperAdmin) {
      const memberships = await this.tenantUserRepository.find({
        where: {
          userId: user.id,
          isActive: true,
        },
        relations: {
          shop: true,
        },
      });

      // Keep only memberships whose shops are active
      const activeMemberships = memberships.filter(
        (membership) => membership.shop?.isActive,
      );

      if (activeMemberships.length === 0) {
        throw new UnauthorizedException(
          'You are not assigned to an active shop.',
        );
      }

      if (activeMemberships.length > 1) {
        throw new UnauthorizedException(
          'Your account is assigned to multiple shops. Please contact the Super Admin.',
        );
      }

      selectedMembership = activeMemberships[0];
      selectedShop = selectedMembership.shop;
    }

    // 5. Generate JWT payload
    const payload = {
      sub: user.id,
      uuid: user.uuid,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,

      // Automatically assigned shop information
      shopId: selectedShop?.id ?? null,
      tenantUserId: selectedMembership?.id ?? null,
      role: selectedMembership?.role ?? null,
    };

    // 6. Generate access token
    const accessToken = await this.jwtService.signAsync(payload);

    // 7. Return response
    return {
      message: 'Login successful.',
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
        isSuperAdmin: user.isSuperAdmin,
      },

      shop: selectedShop
        ? {
            id: selectedShop.id,
            uuid: selectedShop.uuid,
            name: selectedShop.name,
            code: selectedShop.code,
            role: selectedMembership?.role,
          }
        : null,
    };
  }
}