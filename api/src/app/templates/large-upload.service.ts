import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import {
  appendFile,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  truncate,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { extname, join } from 'node:path';
import { getUploadsDirectory } from '../admin/media.service';
import { moveFile, persistentDirectory } from '../storage-paths';
import { TemplatesService } from './templates.service';

/** Largest single request body accepted for one chunk (see main.ts). */
export const UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024;

type Purpose = 'template-file' | 'video';

interface UploadMeta {
  purpose: Purpose;
  fileName: string;
  size: number;
  templateId?: string;
  createdAt: string;
}

const LIMITS: Record<Purpose, { maxBytes: number; extensions: string[] }> = {
  'template-file': { maxBytes: 1024 * 1024 * 1024, extensions: ['.zip'] },
  video: { maxBytes: 500 * 1024 * 1024, extensions: ['.mp4', '.webm', '.mov'] },
};
const UPLOAD_ID = /^[0-9a-f-]{36}$/;
const STALE_MS = 24 * 60 * 60 * 1000;

/**
 * Uploads large files (template ZIPs, promo videos) in pieces so no single
 * request is big or slow enough to be cut off by the host's proxy. Each
 * piece is sent with its byte offset; resending a piece is safe.
 */
@Injectable()
export class LargeUploadService {
  constructor(private readonly templates: TemplatesService) {}

  private directory() {
    return persistentDirectory(process.env.UPLOAD_TEMP_DIR, 'tmp-uploads');
  }

  private paths(id: string) {
    if (!UPLOAD_ID.test(id)) throw new NotFoundException('Upload not found.');
    const base = join(this.directory(), id);
    return { part: `${base}.part`, meta: `${base}.json` };
  }

  private async readMeta(id: string): Promise<UploadMeta> {
    try {
      return JSON.parse(await readFile(this.paths(id).meta, 'utf8'));
    } catch {
      throw new NotFoundException('Upload not found or expired. Start it again.');
    }
  }

  async start(input: {
    purpose?: string;
    fileName?: string;
    size?: number;
    templateId?: string;
  }) {
    const purpose = input.purpose as Purpose;
    const limits = LIMITS[purpose];
    if (!limits) throw new BadRequestException('Unknown upload type.');
    const fileName = String(input.fileName || '').trim().slice(0, 255);
    const size = Math.floor(Number(input.size));
    if (!fileName || !limits.extensions.includes(extname(fileName).toLowerCase())) {
      throw new BadRequestException(
        `Choose a ${limits.extensions.join(', ')} file.`,
      );
    }
    if (!Number.isFinite(size) || size <= 0 || size > limits.maxBytes) {
      throw new BadRequestException(
        `The file must be at most ${Math.round(limits.maxBytes / 1024 / 1024)} MB.`,
      );
    }
    if (purpose === 'template-file') {
      if (!input.templateId) throw new BadRequestException('Choose a template.');
      await this.templates.getAdmin(input.templateId);
    }

    await mkdir(this.directory(), { recursive: true });
    await this.removeStaleUploads();
    const id = randomUUID();
    const meta: UploadMeta = {
      purpose,
      fileName,
      size,
      ...(purpose === 'template-file' ? { templateId: input.templateId } : {}),
      createdAt: new Date().toISOString(),
    };
    const { part, meta: metaPath } = this.paths(id);
    await writeFile(part, Buffer.alloc(0), { mode: 0o600 });
    await writeFile(metaPath, JSON.stringify(meta), { mode: 0o600 });
    return { uploadId: id, chunkSize: UPLOAD_CHUNK_BYTES };
  }

  async appendChunk(id: string, offsetValue: unknown, body: unknown) {
    const meta = await this.readMeta(id);
    const { part } = this.paths(id);
    const chunk = Buffer.isBuffer(body) ? body : null;
    if (!chunk?.length) throw new BadRequestException('Empty upload piece.');
    if (chunk.length > UPLOAD_CHUNK_BYTES) {
      throw new BadRequestException('Upload piece is too large.');
    }
    const offset = Math.floor(Number(offsetValue));
    const received = (await stat(part)).size;
    if (!Number.isFinite(offset) || offset < 0 || offset > received) {
      throw new ConflictException({
        message: 'Upload piece is out of order.',
        received,
      });
    }
    if (offset + chunk.length > meta.size) {
      throw new BadRequestException('Upload is larger than announced.');
    }
    // A resent piece replaces whatever was written from that offset on.
    if (offset < received) await truncate(part, offset);
    await appendFile(part, chunk);
    return { received: offset + chunk.length, size: meta.size };
  }

  async finish(id: string) {
    const meta = await this.readMeta(id);
    const { part, meta: metaPath } = this.paths(id);
    const received = (await stat(part)).size;
    if (received !== meta.size) {
      throw new ConflictException({
        message: `Upload incomplete: ${received} of ${meta.size} bytes received.`,
        received,
      });
    }

    let result: any;
    if (meta.purpose === 'template-file') {
      if (!(await this.hasZipHeader(part))) {
        await this.discard(id);
        throw new BadRequestException('Template downloads must be a valid ZIP file.');
      }
      result = await this.templates.attachStoredFile(
        meta.templateId as string,
        part,
        meta.fileName,
        meta.size,
      );
    } else {
      const directory = join(getUploadsDirectory(), 'course-media');
      await mkdir(directory, { recursive: true });
      const extension = extname(meta.fileName).toLowerCase();
      const filename = `video-${Date.now()}-${randomUUID()}${extension}`;
      await moveFile(part, join(directory, filename));
      const publicBase = String(process.env.UPLOADS_PUBLIC_URL || '/uploads').replace(/\/$/, '');
      result = { url: `${publicBase}/course-media/${filename}`, size: meta.size };
    }
    await unlink(metaPath).catch(() => undefined);
    return result;
  }

  async discard(id: string) {
    const { part, meta } = this.paths(id);
    await rm(part, { force: true });
    await rm(meta, { force: true });
    return { success: true };
  }

  private async hasZipHeader(path: string) {
    const stream = createReadStream(path, { start: 0, end: 3 });
    const bytes: Buffer[] = [];
    for await (const piece of stream) bytes.push(piece as Buffer);
    const head = Buffer.concat(bytes);
    return head[0] === 0x50 && head[1] === 0x4b && [0x03, 0x05, 0x07].includes(head[2]);
  }

  private async removeStaleUploads() {
    const directory = this.directory();
    for (const name of await readdir(directory).catch(() => [] as string[])) {
      const path = join(directory, name);
      const info = await stat(path).catch(() => null);
      if (info && Date.now() - info.mtimeMs > STALE_MS) {
        await rm(path, { force: true });
      }
    }
  }
}
