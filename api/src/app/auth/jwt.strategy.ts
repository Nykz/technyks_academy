import { ServiceUnavailableException } from '@nestjs/common';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService, config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') || 'technyks_super_secret_jwt_key_2026',
    });
  }

  async validate(payload: JwtPayload) {
    let user: any = null;

    if (this.prisma.isDbConnected) {
      try {
        user = await this.prisma.user.findUnique({
          where: { id: payload.sub },
        });
      } catch {
        throw new ServiceUnavailableException('Your data could not be loaded or saved. Please retry shortly.');
      }
    }

    if (!user && !this.prisma.isDbConnected) {
      user = this.prisma.inMemoryUsers.find(candidate => candidate.id === payload.sub);
    }

    if (!user) {
      throw new UnauthorizedException('Invalid authentication token');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
    };
  }
}
