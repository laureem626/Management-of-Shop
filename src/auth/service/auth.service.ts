import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { User } from '../../users/entity/users.entity';
import { TenantUser } from '../../tenants/entity/tenant-user.entity';

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
    const email = loginDto.email.trim().toLowerCase();
    const { password, shopId } = loginDto;

    // ==========================================
    // 1. FIND USER IN PUBLIC.USERS
    // ==========================================

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('LOWER(user.email) = :email', { email })
      .getOne();

    if (!user) {
      throw new UnauthorizedException(
        'Invalid email or password.',
      );
    }

    // ==========================================
    // 2. CHECK USER STATUS
    // ==========================================

    if (!user.isActive) {
      throw new UnauthorizedException(
        'Your account is inactive.',
      );
    }

    // ==========================================
    // 3. VERIFY PASSWORD
    // ==========================================

    const passwordMatch = await bcrypt.compare(
      password,
      user.password,
    );

    if (!passwordMatch) {
      throw new UnauthorizedException(
        'Invalid email or password.',
      );
    }

    let selectedShop: any = null;
    let selectedMembership: TenantUser | null = null;

    // ==========================================
    // 4. IDENTIFY USER'S SHOP
    // ==========================================

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

      // Only active shop memberships
      const activeMemberships = memberships.filter(
        (membership) =>
          membership.shop?.isActive === true,
      );

      if (activeMemberships.length === 0) {
        throw new UnauthorizedException(
          'You are not assigned to an active shop.',
        );
      }

      // If shopId was supplied, select that specific shop
      if (shopId) {
        selectedMembership = activeMemberships.find(
          (membership) => membership.shopId === shopId,
        ) || null;

        if (!selectedMembership) {
          throw new UnauthorizedException(
            'You do not have access to this shop.',
          );
        }

        selectedShop = selectedMembership.shop;
      } else {
        // Automatically select shop if user belongs to only one
        if (activeMemberships.length === 1) {
          selectedMembership = activeMemberships[0];
          selectedShop = selectedMembership.shop;
        } else {
          throw new UnauthorizedException(
            'You belong to multiple shops. Please provide your shopId when logging in.',
          );
        }
      }

      // Validate tenant schema
      if (
        !/^shop_[a-f0-9]{32}$/.test(selectedShop.schemaName)
      ) {
        throw new UnauthorizedException(
          'Invalid shop configuration.',
        );
      }
    }

    // ==========================================
    // 5. GENERATE JWT PAYLOAD
    // ==========================================

    const payload = {
      sub: user.id,
      id: user.id,
      uuid: user.uuid,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,

      shopId: selectedShop?.id ?? null,
      shopUuid: selectedShop?.uuid ?? null,
      schemaName: selectedShop?.schemaName ?? null,

      tenantUserId: selectedMembership?.id ?? null,
      role: selectedMembership?.role ?? null,
    };

    // ==========================================
    // 6. GENERATE ACCESS TOKEN
    // ==========================================

    const accessToken = await this.jwtService.signAsync(payload);

    // ==========================================
    // 7. RETURN RESPONSE
    // ==========================================

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
            schemaName: selectedShop.schemaName,
            role: selectedMembership?.role,
          }
        : null,
    };
  }
}