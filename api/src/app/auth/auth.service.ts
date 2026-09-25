import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import { MailService, emailLayout, escapeHtml } from '../mail/mail.service';

const LEARNER_GOALS = new Set([
  'learn-from-scratch',
  'build-projects',
  'advance-career',
  'ai-automation',
]);
const EXPERIENCE_LEVELS = new Set([
  'new-to-coding',
  'learning-fundamentals',
  'building-projects',
  'working-developer',
]);

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleClient = new OAuth2Client();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService = new ConfigService(),
    private mail: MailService = new MailService(config),
  ) {}

  async onModuleInit() {
    await this.seedDefaultAdmin();
  }

  async seedDefaultAdmin() {
    const adminEmail = String(process.env.ADMIN_EMAIL || 'admin@technyks.com')
      .toLowerCase()
      .trim();
    const initialPassword = String(
      process.env.ADMIN_PASSWORD ||
        (process.env.NODE_ENV === 'production' ? '' : 'admin123'),
    );
    if (!initialPassword) {
      this.logger.log(
        'Admin seed skipped because ADMIN_PASSWORD is not configured.',
      );
      return;
    }
    const passwordHash = await bcrypt.hash(initialPassword, 10);
    const adminUser = {
      id: 'usr_admin_default',
      email: adminEmail,
      passwordHash,
      name: 'Technyks Principal Admin',
      role: 'ADMIN',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (this.prisma.isDbConnected) {
      try {
        const existing = await this.prisma.user.findUnique({
          where: { email: adminEmail },
        });
        if (existing) {
          const adminUpdate: { role?: 'ADMIN'; passwordHash?: string } = {};
          if (existing.role !== 'ADMIN') adminUpdate.role = 'ADMIN';
          if (!existing.passwordHash) adminUpdate.passwordHash = passwordHash;

          if (Object.keys(adminUpdate).length > 0) {
            await this.prisma.user.update({
              where: { id: existing.id },
              data: adminUpdate,
            });
            this.logger.log(
              `Configured administrator access for ${adminEmail}.`,
            );
          }
        } else {
          await this.prisma.user.create({ data: adminUser as any });
        }
      } catch (error: any) {
        throw new Error(
          `Admin database initialization failed: ${error?.message || 'unknown error'}`,
        );
      }
    }

    // Always seed in-memory store
    const inMemExisting = this.prisma.inMemoryUsers.find(
      (u) => u.email === adminEmail,
    );
    if (inMemExisting) {
      inMemExisting.role = 'ADMIN';
      inMemExisting.passwordHash ||= passwordHash;
    } else {
      this.prisma.inMemoryUsers.push(adminUser);
    }
  }

  async signup(dto: {
    email: string;
    password?: string;
    name: string;
  }) {
    const cleanEmail = dto.email.toLowerCase().trim();

    // Check existing user
    let existing: any = null;
    if (this.prisma.isDbConnected) {
      existing = await this.prisma.user.findUnique({
        where: { email: cleanEmail },
      });
    } else {
      existing = this.prisma.inMemoryUsers.find((u) => u.email === cleanEmail);
    }

    if (existing) {
      throw new BadRequestException(
        'An account with this email already exists.',
      );
    }

    let passwordHash: string | null = null;
    if (dto.password) {
      passwordHash = await bcrypt.hash(dto.password, 10);
    }

    // New accounts are always students. Admin access is provisioned separately
    // through the seeded account or an explicit database role change.
    const role = 'STUDENT';
    const newUser = {
      id: `usr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
      email: cleanEmail,
      passwordHash,
      googleId: null,
      name: dto.name,
      role,
      onboardingCompleted: false,
      learnerGoal: null,
      experienceLevel: null,
      membershipPreference: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (this.prisma.isDbConnected) {
      await this.prisma.user.create({ data: newUser as any });
    } else {
      this.prisma.inMemoryUsers.push(newUser);
    }

    const token = this.generateToken(newUser.id, newUser.email, newUser.role);

    return {
      accessToken: token,
      user: this.toPublicUser(newUser),
      requiresOnboarding: true,
    };
  }

  async login(dto: { email: string; password?: string }) {
    const cleanEmail = dto.email.toLowerCase().trim();

    let user: any = null;
    if (this.prisma.isDbConnected) {
      user = await this.prisma.user.findUnique({
        where: { email: cleanEmail },
      });
    }

    if (!this.prisma.isDbConnected && !user) {
      user = this.prisma.inMemoryUsers.find((u) => u.email === cleanEmail);
    }

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (dto.password) {
      if (!user.passwordHash) {
        throw new UnauthorizedException('Please sign in using Google OAuth.');
      }
      const valid = await bcrypt.compare(dto.password, user.passwordHash);
      if (!valid) {
        throw new UnauthorizedException('Invalid email or password.');
      }
    } else {
      throw new BadRequestException('Password is required.');
    }

    const token = this.generateToken(user.id, user.email, user.role);

    return {
      accessToken: token,
      user: this.toPublicUser(user),
      requiresOnboarding: false,
    };
  }

  getPublicConfig() {
    return {
      googleClientId: String(process.env.GOOGLE_CLIENT_ID || '').trim() || null,
    };
  }

  async loginWithGoogle(credential: string) {
    const clientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
    if (!clientId) {
      throw new BadRequestException('Google sign-in is not configured.');
    }
    if (!credential) {
      throw new BadRequestException('Google credential is required.');
    }

    let payload: any;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: credential,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException(
        'Google authentication could not be verified.',
      );
    }

    if (!payload?.sub || !payload?.email || payload.email_verified !== true) {
      throw new UnauthorizedException(
        'A verified Google email address is required.',
      );
    }

    const email = String(payload.email).toLowerCase().trim();
    const googleId = String(payload.sub);
    const name = String(
      payload.name || email.split('@')[0] || 'Technyks learner',
    ).trim();
    const avatarUrl = payload.picture ? String(payload.picture) : null;
    let user: any = null;
    let isNewUser = false;

    if (this.prisma.isDbConnected) {
      user = await this.prisma.user.findUnique({ where: { email } });
      if (user) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            googleId,
            name: user.name || name,
            avatarUrl: avatarUrl || user.avatarUrl,
          },
        });
      } else {
        isNewUser = true;
        user = await this.prisma.user.create({
          data: { email, googleId, name, avatarUrl, role: 'STUDENT' },
        });
      }
    } else {
      user = this.prisma.inMemoryUsers.find(
        (candidate) =>
          candidate.email === email || candidate.googleId === googleId,
      );
      if (user) {
        Object.assign(user, {
          googleId,
          avatarUrl: avatarUrl || user.avatarUrl,
        });
      } else {
        isNewUser = true;
        user = {
          id: `usr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
          email,
          googleId,
          name,
          avatarUrl,
          role: 'STUDENT',
          onboardingCompleted: false,
          learnerGoal: null,
          experienceLevel: null,
          membershipPreference: null,
          passwordHash: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        this.prisma.inMemoryUsers.push(user);
      }
    }

    return {
      accessToken: this.generateToken(user.id, user.email, user.role),
      user: this.toPublicUser(user),
      requiresOnboarding: isNewUser,
    };
  }

  async getProfile(userId: string) {
    let user: any = null;
    if (this.prisma.isDbConnected) {
      user = await this.prisma.user.findUnique({ where: { id: userId } });
    }
    if (!this.prisma.isDbConnected) {
      user ??= this.prisma.inMemoryUsers.find(
        (candidate) => candidate.id === userId,
      );
    }
    if (!user)
      throw new UnauthorizedException('User account could not be found.');
    return this.toPublicUser(user);
  }

  async completeOnboarding(
    userId: string,
    dto: {
      learnerGoal: string;
      experienceLevel: string;
      membershipPreference: string;
    },
  ) {
    const learnerGoal = String(dto.learnerGoal || '').trim();
    const experienceLevel = String(dto.experienceLevel || '').trim();
    const membershipPreference = String(dto.membershipPreference || '').trim();

    if (!LEARNER_GOALS.has(learnerGoal)) {
      throw new BadRequestException('Select a valid learning goal.');
    }
    if (!EXPERIENCE_LEVELS.has(experienceLevel)) {
      throw new BadRequestException('Select a valid experience level.');
    }
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(membershipPreference)) {
      throw new BadRequestException('Select a valid membership program.');
    }

    const data = {
      learnerGoal,
      experienceLevel,
      membershipPreference,
      onboardingCompleted: true,
    };
    let user: any = null;
    if (this.prisma.isDbConnected) {
      user = await this.prisma.user.update({ where: { id: userId }, data });
    } else {
      user = this.prisma.inMemoryUsers.find(
        (candidate) => candidate.id === userId,
      );
      if (user) Object.assign(user, data, { updatedAt: new Date() });
    }
    if (!user)
      throw new UnauthorizedException('User account could not be found.');
    return this.toPublicUser(user);
  }

  async forgotPassword(email: string) {
    const response = {
      message:
        'If an account exists with this email, a reset link has been dispatched.',
    };
    const cleanEmail = email.toLowerCase().trim();
    let user: any = null;
    if (this.prisma.isDbConnected) {
      user = await this.prisma.user.findUnique({
        where: { email: cleanEmail },
      });
    } else {
      user = this.prisma.inMemoryUsers.find((u) => u.email === cleanEmail);
    }

    if (!user) return response;

    const resetToken = this.jwtService.sign(
      { sub: user.id, purpose: 'reset-password' },
      { expiresIn: '30m' },
    );
    await this.sendPasswordResetEmail(user.email, user.name, resetToken);
    return response;
  }

  async resetPassword(resetToken: string, newPassword?: string) {
    try {
      const payload = this.jwtService.verify(resetToken);
      if (payload.purpose !== 'reset-password') {
        throw new BadRequestException('Invalid reset token.');
      }

      if (!newPassword || newPassword.length < 8) {
        throw new BadRequestException(
          'Password must be at least 8 characters.',
        );
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);

      if (this.prisma.isDbConnected) {
        await this.prisma.user.update({
          where: { id: payload.sub },
          data: { passwordHash },
        });
      }

      const u = this.prisma.inMemoryUsers.find((x) => x.id === payload.sub);
      if (u) u.passwordHash = passwordHash;

      return {
        message: 'Password has been reset successfully. You can now login.',
      };
    } catch (e) {
      throw new BadRequestException('Expired or invalid reset token.');
    }
  }

  private generateToken(userId: string, email: string, role: string): string {
    return this.jwtService.sign({
      sub: userId,
      email,
      role,
    });
  }

  private async sendPasswordResetEmail(
    email: string,
    name: string,
    resetToken: string,
  ) {
    const resetUrl = `${this.mail.webAppUrl}/auth/reset-password?token=${encodeURIComponent(resetToken)}`;
    const greetingName = String(name || 'learner').trim();
    await this.mail.send({
      to: [email],
      subject: 'Reset your Technyks Academy password',
      text:
        `Hello ${greetingName},

` +
        `Use this secure link to reset your password within 30 minutes:
${resetUrl}

` +
        'If you did not request this, you can ignore this email.',
      html: emailLayout(
        'Reset your password',
        `<p>Hello ${escapeHtml(greetingName)},</p><p>Use the button below to choose a new password. The link works for 30 minutes.</p>`,
        { label: 'Reset password', url: resetUrl },
        'If you did not request this, you can ignore this email. Your password stays the same.',
      ),
    });
  }

  private toPublicUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl || null,
      onboardingCompleted:
        user.role === 'ADMIN' ? true : Boolean(user.onboardingCompleted),
      learnerGoal: user.learnerGoal || null,
      experienceLevel: user.experienceLevel || null,
      membershipPreference: user.membershipPreference || null,
    };
  }
}
