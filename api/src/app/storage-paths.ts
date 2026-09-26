import { homedir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';

/**
 * Where files uploaded through the site (thumbnails, promo videos, paid
 * template ZIPs) are kept.
 *
 * Hostinger runs every deploy from a brand-new
 * `.../hbuilds/versions/<id>/nodejs` folder, so anything written under the
 * app's working directory disappears on the next deploy. In production a
 * relative or unset path is therefore placed under a folder outside the
 * build: PERSISTENT_DATA_DIR, or `~/technyks-data` by default
 * (e.g. UPLOADS_DIR=./uploads -> /home/<user>/technyks-data/uploads).
 * An absolute path is always used exactly as given.
 */
export function persistentDirectory(
  configured: string | undefined,
  ...defaultSegments: string[]
) {
  const value = String(configured || '').trim();
  if (value && isAbsolute(value)) return resolve(value);

  if (process.env.NODE_ENV === 'production') {
    const root =
      String(process.env.PERSISTENT_DATA_DIR || '').trim() ||
      join(homedir(), 'technyks-data');
    const relativePath = value
      ? value.replace(/^\.[\\/]/, '')
      : join(...defaultSegments);
    return resolve(root, relativePath);
  }

  return resolve(value || join(process.cwd(), ...defaultSegments));
}
