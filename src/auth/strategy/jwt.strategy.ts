import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../../public/entity/users.entity';
import { TenantUser } from '../../public/entity/tenant-user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(TenantUser)
    private readonly tenantUserRepository: Repository<TenantUser>,

    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    // 1. Verify user
    const user = await this.userRepository.findOne({
      where: {
        id: payload.sub,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid or inactive user.');
    }

    // 2. Super Admin does not need a shop membership
    if (user.isSuperAdmin) {
      return {
        id: user.id,
        uuid: user.uuid,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isSuperAdmin: true,
        shopId: null,
        role: null,
      };
    }

    // 3. Verify the user's active shop membership
    if (!payload.shopId || !payload.tenantUserId) {
      throw new UnauthorizedException(
        'Your account is not assigned to a shop.',
      );
    }

    const membership = await this.tenantUserRepository.findOne({
      where: {
        id: payload.tenantUserId,
        userId: user.id,
        shopId: payload.shopId,
        isActive: true,
      },
      relations: {
        shop: true,
      },
    });

    if (!membership || !membership.shop?.isActive) {
      throw new UnauthorizedException(
        'Your shop membership is invalid or inactive.',
      );
    }

    // 4. Return authenticated user and trusted shop information
    return {
      id: user.id,
      uuid: user.uuid,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isSuperAdmin: false,

      shopId: membership.shop.id,
      shopUuid: membership.shop.uuid,
      schemaName: membership.shop.schemaName,
      role: membership.role,
      tenantUserId: membership.id,
    };
  }
}