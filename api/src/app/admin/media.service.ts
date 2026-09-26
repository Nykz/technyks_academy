import {
  BadRequestException,
  Injectable,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { persistentDirectory } from '../storage-paths';

const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const VIDEO_TYPES: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/ogg': '.ogv',
  'video/quicktime': '.mov',
};

export function getUploadsDirectory() {
  return persistentDirectory(process.env.UPLOADS_DIR, 'uploads');
}

@Injectable()
export class MediaService {
  async store(kind: 'image' | 'video', file?: any) {
    if (kind !== 'image' && kind !== 'video') {
      throw new BadRequestException('Media type must be image or video.');
    }
    if (!file?.buffer?.length) {
      throw new BadRequestException('Choose a file to upload.');
    }

    const allowedTypes = kind === 'image' ? IMAGE_TYPES : VIDEO_TYPES;
    const extension = allowedTypes[String(file.mimetype || '').toLowerCase()];
    if (!extension) {
      throw new UnsupportedMediaTypeException(
        kind === 'image'
          ? 'Use a JPG, PNG, WebP, or GIF image.'
          : 'Use an MP4, WebM, OGG, or MOV video.',
      );
    }

    const maxBytes = kind === 'image' ? 10 * 1024 * 1024 : 250 * 1024 * 1024;
    if (Number(file.size || file.buffer.length) > maxBytes) {
      throw new BadRequestException(
        kind === 'image'
          ? 'Course images must be 10 MB or smaller.'
          : 'Promotional videos must be 250 MB or smaller.',
      );
    }

    const directory = join(getUploadsDirectory(), 'course-media');
    await mkdir(directory, { recursive: true });
    const filename = `${kind}-${Date.now()}-${randomUUID()}${extension}`;
    await writeFile(join(directory, filename), file.buffer, { mode: 0o644 });

    const publicBase = String(
      process.env.UPLOADS_PUBLIC_URL || '/uploads',
    ).replace(/\/$/, '');
    return {
      url: `${publicBase}/course-media/${filename}`,
      filename,
      mimeType: file.mimetype,
      size: Number(file.size || file.buffer.length),
    };
  }

  async remove(urlValue: unknown) {
    const value = String(urlValue || '').trim();
    if (!value) return { success: true };

    let pathname = value;
    try {
      pathname = new URL(value).pathname;
    } catch {
      // Relative upload URLs are supported.
    }

    if (!pathname.includes('/uploads/course-media/')) {
      throw new BadRequestException('Only uploaded course media can be removed.');
    }

    const filename = basename(pathname);
    if (!/^(?:image|video)-[A-Za-z0-9-]+\.[A-Za-z0-9]+$/.test(filename)) {
      throw new BadRequestException('Invalid uploaded media path.');
    }

    try {
      await unlink(join(getUploadsDirectory(), 'course-media', filename));
    } catch (error: any) {
      if (error?.code !== 'ENOENT') throw error;
    }
    return { success: true };
  }
}
