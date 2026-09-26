import { createHash } from 'crypto';
import { describe, expect, it } from 'vitest';
import { parseBunnyVideoRef, signedBunnyEmbedUrl, withPromoEmbed } from './bunny-embed';

const ID = '9c58b7f0-b2c5-4e51-904c-bc947b0768a7';

describe('parseBunnyVideoRef', () => {
  it.each([
    [ID],
    [`bunny:${ID}`],
    [`https://iframe.mediadelivery.net/embed/750648/${ID}`],
    [`https://iframe.mediadelivery.net/play/750648/${ID}?autoplay=true`],
    [`https://player.mediadelivery.net/embed/750648/${ID}`],
    [`https://vz-723bdd94-d0c.b-cdn.net/${ID}/playlist.m3u8`],
    [ID.toUpperCase()],
  ])('reads the video ID from %s', (input) => {
    expect(parseBunnyVideoRef(input)).toBe(ID);
  });

  it.each([
    ['https://www.youtube.com/watch?v=xQkn047-_1E'],
    ['https://vimeo.com/123456'],
    [`https://evil.example.com/embed/1/${ID}`],
    ['/uploads/course-media/video.mp4'],
    [''],
  ])('ignores non-Bunny values: %s', (input) => {
    expect(parseBunnyVideoRef(input)).toBeNull();
  });
});

describe('signedBunnyEmbedUrl', () => {
  const env = {
    BUNNY_STREAM_ENABLED: 'true',
    BUNNY_STREAM_LIBRARY_ID: '750648',
    BUNNY_STREAM_TOKEN_KEY: 'token-key',
  };

  it("signs with Bunny's SHA256(tokenKey + videoId + expires) scheme", () => {
    const signed = signedBunnyEmbedUrl(ID, { autoplay: false }, env)!;
    const expected = createHash('sha256')
      .update(`token-key${ID}${signed.expires}`)
      .digest('hex');
    expect(signed.token).toBe(expected);
    expect(signed.url).toBe(
      `https://iframe.mediadelivery.net/embed/750648/${ID}?token=${expected}&expires=${signed.expires}&autoplay=false`,
    );
  });

  it('returns null when Bunny is not configured', () => {
    expect(signedBunnyEmbedUrl(ID, {}, { ...env, BUNNY_STREAM_ENABLED: 'false' })).toBeNull();
    expect(signedBunnyEmbedUrl(ID, {}, { ...env, BUNNY_STREAM_TOKEN_KEY: '' })).toBeNull();
  });
});

describe('withPromoEmbed', () => {
  it('signs only a saved "bunny:" intro and leaves other intros alone', () => {
    process.env['BUNNY_STREAM_ENABLED'] = 'true';
    process.env['BUNNY_STREAM_LIBRARY_ID'] = '750648';
    process.env['BUNNY_STREAM_TOKEN_KEY'] = 'token-key';

    expect(withPromoEmbed({ promoVideoUrl: `bunny:${ID}` }).promoEmbedUrl).toContain(`/embed/750648/${ID}?token=`);
    expect(withPromoEmbed({ promoVideoUrl: 'https://youtu.be/xQkn047-_1E' }).promoEmbedUrl).toBeNull();
    // A raw lesson ID that was never saved as a course intro is never signed.
    expect(withPromoEmbed({ promoVideoUrl: ID }).promoEmbedUrl).toBeNull();
    expect(withPromoEmbed({ promoVideoUrl: null }).promoEmbedUrl).toBeNull();
  });
});
