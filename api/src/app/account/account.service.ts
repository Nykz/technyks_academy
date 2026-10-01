import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../admin/media.service';

const MAX_AVATAR_BYTES = 3 * 1024 * 1024;

const SOCIAL_HOSTS: Record<string, RegExp> = {
  linkedinUrl: /(^|\.)linkedin\.com$/i,
  githubUrl: /(^|\.)github\.com$/i,
  twitterUrl: /(^|\.)(x|twitter)\.com$/i,
  youtubeUrl: /(^|\.)(youtube\.com|youtu\.be)$/i,
};
const LINK_LABELS: Record<string, string> = {
  websiteUrl: 'Website',
  linkedinUrl: 'LinkedIn',
  githubUrl: 'GitHub',
  twitterUrl: 'X (Twitter)',
  youtubeUrl: 'YouTube',
};

/** JPEG, PNG or WebP, checked by the file's first bytes, not its name. */
export function detectImageType(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

/** "https://…" link or null; rejects other schemes and wrong social sites. */
export function cleanProfileLink(field: string, value: unknown): string | null {
  let text = String(value ?? '').trim();
  if (!text) return null;
  if (!/^https?:\/\//i.test(text)) text = `https://${text}`;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new BadRequestException(`${LINK_LABELS[field]} must be a valid link.`);
  }
  if (!/^https?:$/.test(url.protocol) || !url.hostname.includes('.')) {
    throw new BadRequestException(`${LINK_LABELS[field]} must be a valid link.`);
  }
  const allowedHost = SOCIAL_HOSTS[field];
  if (allowedHost && !allowedHost.test(url.hostname)) {
    throw new BadRequestException(`${LINK_LABELS[field]} must be a ${LINK_LABELS[field]} link.`);
  }
  const clean = url.toString();
  if (clean.length > 191) throw new BadRequestException(`${LINK_LABELS[field]} link is too long.`);
  return clean;
}

/**
 * The signed-in user's own account: public profile, photo, password,
 * email preferences and purchase history (Account settings).
 */
@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  async getProfile(userId: string) {
    return this.toAccount(await this.findUser(userId));
  }

  async updateProfile(userId: string, dto: any) {
    const data: Record<string, any> = {};
    if (dto.name !== undefined) {
      const name = String(dto.name || '').replace(/\s+/g, ' ').trim();
      if (name.length < 2) throw new BadRequestException('Enter your full name.');
      if (name.length > 80) throw new BadRequestException('Name must be 80 characters or fewer.');
      data.name = name;
    }
    if (dto.headline !== undefined) {
      const headline = String(dto.headline || '').trim();
      if (headline.length > 60) throw new BadRequestException('Headline must be 60 characters or fewer.');
      data.headline = headline || null;
    }
    if (dto.bio !== undefined) {
      const bio = String(dto.bio || '').trim();
      if (bio.length > 2000) throw new BadRequestException('Biography must be 2,000 characters or fewer.');
      data.bio = bio || null;
    }
    for (const field of Object.keys(LINK_LABELS)) {
      if (dto[field] !== undefined) data[field] = cleanProfileLink(field, dto[field]);
    }
    return this.toAccount(await this.saveUser(userId, data));
  }

  async updateNotifications(userId: string, dto: any) {
    const data: Record<string, any> = {};
    if (dto.emailAnnouncements !== undefined) data.emailAnnouncements = Boolean(dto.emailAnnouncements);
    return this.toAccount(await this.saveUser(userId, data));
  }

  async uploadAvatar(userId: string, file: any) {
    const buffer: Buffer | undefined = file?.buffer;
    if (!buffer?.length) throw new BadRequestException('Choose an image to upload.');
    if (buffer.length > MAX_AVATAR_BYTES) throw new BadRequestException('Profile photos must be 3 MB or smaller.');
    const mimetype = detectImageType(buffer);
    if (!mimetype) throw new UnsupportedMediaTypeException('Use a JPG, PNG or WebP image.');

    const previous = (await this.findUser(userId)).avatarUrl;
    const stored = await this.media.store('image', { buffer, mimetype, size: buffer.length });
    const saved = await this.saveUser(userId, { avatarUrl: stored.url });
    await this.removeUploadedAvatar(previous);
    return this.toAccount(saved);
  }

  async removeAvatar(userId: string) {
    const previous = (await this.findUser(userId)).avatarUrl;
    const saved = await this.saveUser(userId, { avatarUrl: null });
    await this.removeUploadedAvatar(previous);
    return this.toAccount(saved);
  }

  async changePassword(userId: string, dto: any) {
    const user = await this.findUser(userId);
    const newPassword = String(dto.newPassword || '');
    if (newPassword.length < 8) throw new BadRequestException('New password must be at least 8 characters.');
    if (newPassword.length > 128) throw new BadRequestException('New password is too long.');
    if (user.passwordHash) {
      const ok = await bcrypt.compare(String(dto.currentPassword || ''), user.passwordHash);
      if (!ok) throw new UnauthorizedException('Your current password is incorrect.');
      if (await bcrypt.compare(newPassword, user.passwordHash)) {
        throw new BadRequestException('Choose a password different from your current one.');
      }
    }
    const hadPassword = Boolean(user.passwordHash);
    await this.saveUser(userId, { passwordHash: await bcrypt.hash(newPassword, 10) });
    return {
      message: hadPassword
        ? 'Your password has been changed.'
        : 'Password created. You can now also log in with your email and password.',
    };
  }

  /** Successful payments, newest first, with what was bought. */
  async purchases(userId: string) {
    const payments: any[] = this.prisma.isDbConnected
      ? await this.prisma.payment.findMany({
          where: { userId, status: { in: ['SUCCESS', 'REFUNDED'] } },
          include: { course: { select: { title: true, slug: true } } },
          orderBy: { createdAt: 'desc' },
          take: 200,
        })
      : this.prisma.inMemoryPayments
          .filter((item) => item.userId === userId && ['SUCCESS', 'REFUNDED'].includes(item.status))
          .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

    const templateIds = [...new Set(payments.flatMap((payment) => templateIdsOf(payment)))];
    const planIds = [...new Set(payments.map((payment) => payment.planId).filter(Boolean))];
    const [templates, plans] = this.prisma.isDbConnected
      ? await Promise.all([
          templateIds.length
            ? this.prisma.uiTemplate.findMany({ where: { id: { in: templateIds } }, select: { id: true, title: true, slug: true } })
            : [],
          planIds.length
            ? this.prisma.membershipPlan.findMany({ where: { id: { in: planIds } }, select: { id: true, name: true } })
            : [],
        ])
      : [
          this.prisma.inMemoryUiTemplates.filter((item) => templateIds.includes(item.id)),
          this.prisma.inMemoryMembershipPlans.filter((item) => planIds.includes(item.id)),
        ];
    const templateById = new Map<string, any>((templates as any[]).map((item) => [item.id, item]));
    const planById = new Map<string, any>((plans as any[]).map((item) => [item.id, item]));
    const courseById = new Map<string, any>(this.prisma.inMemoryCourses.map((item) => [item.id, item]));

    return payments.map((payment) => {
      const items: { type: 'COURSE' | 'TEMPLATE' | 'MEMBERSHIP'; title: string; slug?: string }[] = [];
      const course = payment.course || (payment.courseId ? courseById.get(payment.courseId) : null);
      if (course) items.push({ type: 'COURSE', title: course.title, slug: course.slug });
      for (const id of templateIdsOf(payment)) {
        const template: any = templateById.get(id);
        if (template) items.push({ type: 'TEMPLATE', title: template.title, slug: template.slug });
      }
      const plan: any = payment.planId ? planById.get(payment.planId) : null;
      if (plan) items.push({ type: 'MEMBERSHIP', title: `${plan.name} membership` });
      if (!items.length) items.push({ type: 'COURSE', title: 'Removed product' });
      return {
        id: payment.id,
        date: payment.createdAt,
        items,
        amount: Number(payment.amount || 0),
        currency: payment.currency || 'INR',
        status: payment.status,
        couponCode: payment.couponCode || null,
        reference: payment.paymentIntentId || null,
      };
    });
  }

  private async removeUploadedAvatar(url: string | null | undefined) {
    if (!url || !url.includes('/uploads/course-media/')) return;
    try {
      await this.media.remove(url);
    } catch {
      // Already gone; nothing to clean up.
    }
  }

  private async findUser(userId: string): Promise<any> {
    const user = this.prisma.isDbConnected
      ? await this.prisma.user.findUnique({ where: { id: userId } })
      : this.prisma.inMemoryUsers.find((item) => item.id === userId);
    if (!user) throw new NotFoundException('Account not found.');
    return user;
  }

  private async saveUser(userId: string, data: Record<string, any>) {
    if (!Object.keys(data).length) return this.findUser(userId);
    if (this.prisma.isDbConnected) {
      return this.prisma.user.update({ where: { id: userId }, data });
    }
    const user = await this.findUser(userId);
    Object.assign(user, data, { updatedAt: new Date() });
    return user;
  }

  private toAccount(user: any) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl || null,
      headline: user.headline || '',
      bio: user.bio || '',
      websiteUrl: user.websiteUrl || '',
      linkedinUrl: user.linkedinUrl || '',
      githubUrl: user.githubUrl || '',
      twitterUrl: user.twitterUrl || '',
      youtubeUrl: user.youtubeUrl || '',
      emailAnnouncements: user.emailAnnouncements !== false,
      hasPassword: Boolean(user.passwordHash),
      googleLinked: Boolean(user.googleId),
      createdAt: user.createdAt || null,
    };
  }
}

function templateIdsOf(payment: any): string[] {
  const value = payment.templateProductIds;
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}
