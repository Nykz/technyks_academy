import * as crypto from 'crypto';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Extracts a Bunny Stream video ID from what an admin is likely to paste:
 * the bare ID, "bunny:<id>", an embed/play link
 * (iframe.mediadelivery.net / player.mediadelivery.net / video.bunnycdn.com
 * .../embed|play/<library>/<id>) or a CDN link (vz-….b-cdn.net/<id>/…).
 */
export function parseBunnyVideoRef(value: unknown): string | null {
  const input = String(value ?? '').trim();
  if (!input) return null;
  const bare = input.replace(/^bunny:/i, '');
  if (GUID.test(bare)) return bare.toLowerCase();
  try {
    const url = new URL(input);
    const host = url.hostname.toLowerCase();
    const isBunnyHost =
      host.endsWith('mediadelivery.net') ||
      host === 'video.bunnycdn.com' ||
      host.endsWith('.b-cdn.net');
    if (!isBunnyHost) return null;
    const id = url.pathname.split('/').find((part) => GUID.test(part));
    return id ? id.toLowerCase() : null;
  } catch {
    return null;
  }
}

/** True for values stored as a Bunny video reference ("bunny:<id>"). */
export function isBunnyRef(value: unknown) {
  return /^bunny:/i.test(String(value ?? '').trim());
}

/**
 * Signed Bunny player URL, or null when Bunny is not configured. The token is
 * SHA256_HEX(tokenKey + videoId + expires), as Bunny's embed token
 * authentication requires; it works whether or not that check is enabled.
 */
export function signedBunnyEmbedUrl(
  videoId: string,
  options: { autoplay?: boolean; ttlSeconds?: number } = {},
  env: Record<string, string | undefined> = process.env,
) {
  const libraryId = String(env['BUNNY_STREAM_LIBRARY_ID'] || '').trim();
  const tokenKey = String(env['BUNNY_STREAM_TOKEN_KEY'] || '').trim();
  const enabled = String(env['BUNNY_STREAM_ENABLED'] || '').toLowerCase() === 'true';
  if (!enabled || !libraryId || !tokenKey || !videoId) return null;
  const expires = Math.floor(Date.now() / 1000) + (options.ttlSeconds ?? 4 * 3600);
  const token = crypto
    .createHash('sha256')
    .update(`${tokenKey}${videoId}${expires}`)
    .digest('hex');
  return {
    url: `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}?token=${token}&expires=${expires}&autoplay=${options.autoplay ? 'true' : 'false'}`,
    token,
    expires,
  };
}

/**
 * Adds promoEmbedUrl (a freshly signed player URL) to a course whose intro
 * video is a Bunny reference. Only the course's own saved intro is ever
 * signed, so this cannot be used to unlock paid lesson videos.
 */
export function withPromoEmbed<T extends { promoVideoUrl?: string | null }>(
  course: T,
): T & { promoEmbedUrl: string | null } {
  if (!course || typeof course !== 'object') return course as any;
  const ref = isBunnyRef(course.promoVideoUrl)
    ? parseBunnyVideoRef(course.promoVideoUrl)
    : null;
  return {
    ...course,
    promoEmbedUrl: ref ? signedBunnyEmbedUrl(ref)?.url ?? null : null,
  };
}
