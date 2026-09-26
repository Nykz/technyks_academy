import {
  BadRequestException,
  Injectable,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { persistentDirectory } from '../storage-paths';
import { PrismaService } from '../prisma/prisma.service';

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

/** Images are stored in the database in chunks of this size. */
const CHUNK_BYTES = 256 * 1024;
const MEDIA_FILENAME = /^(?:image|video)-[A-Za-z0-9-]+\.[A-Za-z0-9]+$/;

export function getUploadsDirectory() {
  return persistentDirectory(process.env.UPLOADS_DIR, 'uploads');
}

@Injectable()
export class MediaService {
  constructor(private readonly prisma: PrismaService) {}

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

    const filename = `${kind}-${Date.now()}-${randomUUID()}${extension}`;
    const buffer: Buffer = file.buffer;
    if (kind === 'image' && this.prisma.isDbConnected) {
      // Images live in the database, so redeploys can never remove them.
      // Each chunk is its own INSERT: a nested create would send every chunk
      // in one statement and exceed the server's max_allowed_packet.
      await this.prisma.$transaction(
        async (db) => {
          const asset = await db.mediaAsset.create({
            data: {
              filename,
              mimeType: String(file.mimetype).toLowerCase(),
              size: buffer.length,
            },
          });
          for (let index = 0; index * CHUNK_BYTES < buffer.length; index += 1) {
            await db.mediaChunk.create({
              data: {
                assetId: asset.id,
                index,
                data: buffer.subarray(index * CHUNK_BYTES, (index + 1) * CHUNK_BYTES),
              },
            });
          }
        },
        { timeout: 60_000, maxWait: 10_000 },
      );
    } else {
      // Videos (too large for the database) go to the persistent folder
      // outside the build; Bunny links are the recommended way to add intros.
      const directory = join(getUploadsDirectory(), 'course-media');
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, filename), buffer, { mode: 0o644 });
    }

    const publicBase = String(
      process.env.UPLOADS_PUBLIC_URL || '/uploads',
    ).replace(/\/$/, '');
    return {
      url: `${publicBase}/course-media/${filename}`,
      filename,
      mimeType: file.mimetype,
      size: buffer.length,
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
    if (!MEDIA_FILENAME.test(filename)) {
      throw new BadRequestException('Invalid uploaded media path.');
    }

    if (this.prisma.isDbConnected) {
      await this.prisma.mediaAsset.deleteMany({ where: { filename } });
    }
    try {
      await unlink(join(getUploadsDirectory(), 'course-media', filename));
    } catch (error: any) {
      if (error?.code !== 'ENOENT') throw error;
    }
    return { success: true };
  }

  /** An uploaded image stored in the database, or null if it isn't there. */
  async read(
    filename: string,
  ): Promise<{ mimeType: string; data: Buffer } | null> {
    if (!MEDIA_FILENAME.test(filename) || !this.prisma.isDbConnected) {
      return null;
    }
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { filename },
      include: { chunks: { orderBy: { index: 'asc' } } },
    });
    if (!asset) return null;
    return {
      mimeType: asset.mimeType,
      data: Buffer.concat(asset.chunks.map((chunk) => Buffer.from(chunk.data))),
    };
  }
}
