import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { isStaleChunkError } from './app-version.service';

describe('isStaleChunkError', () => {
  it('recognises the errors browsers throw for a removed page file', () => {
    expect(isStaleChunkError(new TypeError('Failed to fetch dynamically imported module: https://technyks.com/chunk-ABC.js'))).toBe(true);
    expect(isStaleChunkError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isStaleChunkError(new Error('error loading dynamically imported module'))).toBe(true);
  });

  it('ignores ordinary navigation errors', () => {
    expect(isStaleChunkError(new Error('Cannot match any routes'))).toBe(false);
    expect(isStaleChunkError(null)).toBe(false);
  });
});
