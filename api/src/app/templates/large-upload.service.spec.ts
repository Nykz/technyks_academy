import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LargeUploadService } from './large-upload.service';

describe('LargeUploadService', () => {
  let root: string;
  const original = { ...process.env };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'tk-upload-'));
    process.env.NODE_ENV = 'development';
    process.env.UPLOAD_TEMP_DIR = join(root, 'tmp');
    process.env.UPLOADS_DIR = join(root, 'uploads');
    process.env.UPLOADS_PUBLIC_URL = 'https://api.example.com/uploads';
  });
  afterEach(() => {
    process.env = { ...original };
    rmSync(root, { recursive: true, force: true });
  });

  const templates = () => ({
    getAdmin: vi.fn().mockResolvedValue({ id: 't1' }),
    attachStoredFile: vi.fn().mockImplementation(async (_id, path, name, size) => ({
      fileName: name,
      fileSize: size,
      bytes: readFileSync(path),
    })),
  });

  it('joins pieces, accepts a resent piece, and publishes a video', async () => {
    const service = new LargeUploadService(templates() as any);
    const bytes = Buffer.from('0123456789abcdef');
    const { uploadId } = await service.start({ purpose: 'video', fileName: 'promo.mp4', size: bytes.length });

    await service.appendChunk(uploadId, 0, bytes.subarray(0, 8));
    // The same piece arrives twice (e.g. a retry after a timeout).
    await service.appendChunk(uploadId, 0, bytes.subarray(0, 8));
    await service.appendChunk(uploadId, 8, bytes.subarray(8));
    const result = await service.finish(uploadId);

    expect(result.url).toMatch(/^https:\/\/api\.example\.com\/uploads\/course-media\/video-.+\.mp4$/);
    const stored = join(root, 'uploads', 'course-media', result.url.split('/').pop());
    expect(readFileSync(stored)).toEqual(bytes);
  });

  it('reports where to resume when a piece skips ahead', async () => {
    const service = new LargeUploadService(templates() as any);
    const { uploadId } = await service.start({ purpose: 'video', fileName: 'a.mp4', size: 10 });
    await service.appendChunk(uploadId, 0, Buffer.from('abcd'));
    await expect(service.appendChunk(uploadId, 8, Buffer.from('ij'))).rejects.toMatchObject({
      response: { received: 4 },
    });
  });

  it('refuses to finish an incomplete upload', async () => {
    const service = new LargeUploadService(templates() as any);
    const { uploadId } = await service.start({ purpose: 'video', fileName: 'a.mp4', size: 10 });
    await service.appendChunk(uploadId, 0, Buffer.from('abcd'));
    await expect(service.finish(uploadId)).rejects.toThrow('Upload incomplete');
  });

  it('attaches a real ZIP to the template and rejects a fake one', async () => {
    const deps = templates();
    const service = new LargeUploadService(deps as any);
    const zip = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('rest-of-zip')]);
    const first = await service.start({ purpose: 'template-file', fileName: 'kit.zip', size: zip.length, templateId: 't1' });
    await service.appendChunk(first.uploadId, 0, zip);
    const attached: any = await service.finish(first.uploadId);
    expect(deps.attachStoredFile).toHaveBeenCalledWith('t1', expect.any(String), 'kit.zip', zip.length);
    expect(attached.bytes).toEqual(zip);

    const fake = Buffer.from('not a zip file');
    const second = await service.start({ purpose: 'template-file', fileName: 'kit.zip', size: fake.length, templateId: 't1' });
    await service.appendChunk(second.uploadId, 0, fake);
    await expect(service.finish(second.uploadId)).rejects.toThrow('valid ZIP');
  });

  it('only accepts the expected file types', async () => {
    const service = new LargeUploadService(templates() as any);
    await expect(service.start({ purpose: 'video', fileName: 'virus.exe', size: 10 })).rejects.toThrow('Choose a');
    await expect(service.start({ purpose: 'other', fileName: 'a.zip', size: 10 })).rejects.toThrow('Unknown upload type');
  });
});
