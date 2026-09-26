import { afterEach, describe, expect, it } from 'vitest';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { persistentDirectory } from './storage-paths';

describe('persistentDirectory', () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it('keeps production uploads outside the per-deploy build folder', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.PERSISTENT_DATA_DIR;
    expect(persistentDirectory('./uploads', 'uploads')).toBe(
      resolve(homedir(), 'technyks-data', 'uploads'),
    );
    expect(persistentDirectory(undefined, 'private_uploads', 'templates')).toBe(
      resolve(homedir(), 'technyks-data', 'private_uploads', 'templates'),
    );
  });

  it('uses PERSISTENT_DATA_DIR as the production root when set', () => {
    process.env.NODE_ENV = 'production';
    process.env.PERSISTENT_DATA_DIR = resolve('/srv/technyks');
    expect(persistentDirectory('./uploads', 'uploads')).toBe(
      resolve('/srv/technyks', 'uploads'),
    );
  });

  it('uses an absolute path exactly as configured', () => {
    process.env.NODE_ENV = 'production';
    const absolute = resolve('/data/media');
    expect(persistentDirectory(absolute, 'uploads')).toBe(absolute);
  });

  it('stays inside the project during local development', () => {
    process.env.NODE_ENV = 'development';
    expect(persistentDirectory(undefined, 'uploads')).toBe(
      resolve(join(process.cwd(), 'uploads')),
    );
  });
});
