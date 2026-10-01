import { describe, expect, it, vi } from 'vitest';
import * as bcrypt from 'bcryptjs';
import { BadRequestException, UnauthorizedException, UnsupportedMediaTypeException } from '@nestjs/common';
import { AccountService, cleanProfileLink, detectImageType } from './account.service';
import { googleAvatarFor } from '../auth/auth.service';

function setup(user: any) {
  const prisma: any = {
    isDbConnected: true,
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
      update: vi.fn(async ({ data }: any) => Object.assign(user, data)),
    },
  };
  const media: any = {
    store: vi.fn().mockResolvedValue({ url: '/uploads/course-media/image-1-new.jpg' }),
    remove: vi.fn().mockResolvedValue({ success: true }),
  };
  return { prisma, media, service: new AccountService(prisma, media) };
}

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);

describe('AccountService', () => {
  it('updates the public profile and normalises links', async () => {
    const { service } = setup({ id: 'u1', name: 'Old' });
    const account = await service.updateProfile('u1', {
      name: '  Nikhil   Agarwal ',
      headline: 'Angular developer',
      linkedinUrl: 'linkedin.com/in/nikhil',
      websiteUrl: '',
    });
    expect(account.name).toBe('Nikhil Agarwal');
    expect(account.headline).toBe('Angular developer');
    expect(account.linkedinUrl).toBe('https://linkedin.com/in/nikhil');
    expect(account.websiteUrl).toBe('');
  });

  it('rejects a link to the wrong site and non-web links', () => {
    expect(() => cleanProfileLink('githubUrl', 'https://evil.example/x')).toThrow(BadRequestException);
    expect(() => cleanProfileLink('websiteUrl', 'javascript:alert(1)')).toThrow(BadRequestException);
    expect(cleanProfileLink('twitterUrl', 'x.com/technyks')).toBe('https://x.com/technyks');
  });

  it('stores a new photo and deletes the previous uploaded one', async () => {
    const { service, media } = setup({ id: 'u1', avatarUrl: '/uploads/course-media/image-0-old.jpg' });
    const account = await service.uploadAvatar('u1', { buffer: JPEG });
    expect(media.store).toHaveBeenCalledWith('image', expect.objectContaining({ mimetype: 'image/jpeg' }));
    expect(account.avatarUrl).toBe('/uploads/course-media/image-1-new.jpg');
    expect(media.remove).toHaveBeenCalledWith('/uploads/course-media/image-0-old.jpg');
  });

  it('refuses files that are not really images, whatever their name', async () => {
    const { service } = setup({ id: 'u1' });
    await expect(
      service.uploadAvatar('u1', { buffer: Buffer.from('<svg onload=alert(1)>…………'), mimetype: 'image/png' }),
    ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
    expect(detectImageType(JPEG)).toBe('image/jpeg');
  });

  it('removing the photo keeps a Google photo URL untouched in storage', async () => {
    const { service, media } = setup({ id: 'u1', avatarUrl: 'https://lh3.googleusercontent.com/a/x' });
    const account = await service.removeAvatar('u1');
    expect(account.avatarUrl).toBeNull();
    expect(media.remove).not.toHaveBeenCalled();
  });

  it('requires the current password to change it', async () => {
    const passwordHash = await bcrypt.hash('correct-horse', 4);
    const { service } = setup({ id: 'u1', passwordHash });
    await expect(
      service.changePassword('u1', { currentPassword: 'wrong', newPassword: 'new-password-1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    const result = await service.changePassword('u1', { currentPassword: 'correct-horse', newPassword: 'new-password-1' });
    expect(result.message).toBe('Your password has been changed.');
  });

  it('lets Google-only accounts create a password', async () => {
    const { service } = setup({ id: 'u1', passwordHash: null, googleId: 'g1' });
    const result = await service.changePassword('u1', { newPassword: 'brand-new-pass' });
    expect(result.message).toContain('Password created');
  });
});

describe('Google sign-in photo', () => {
  it('uses the Google photo unless the student uploaded their own', () => {
    expect(googleAvatarFor(null, 'https://lh3.googleusercontent.com/a/new')).toBe('https://lh3.googleusercontent.com/a/new');
    expect(googleAvatarFor('https://lh3.googleusercontent.com/a/old', 'https://lh3.googleusercontent.com/a/new')).toBe(
      'https://lh3.googleusercontent.com/a/new',
    );
    expect(googleAvatarFor('/uploads/course-media/image-1.jpg', 'https://lh3.googleusercontent.com/a/new')).toBe(
      '/uploads/course-media/image-1.jpg',
    );
  });
});
