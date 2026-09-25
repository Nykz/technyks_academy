import { describe, expect, it, vi } from 'vitest';
import { VideoService } from './video.service';

describe('VideoService - YouTube Membership playback', () => {
  it('returns a protected YouTube embed for an authorized free-preview lesson', async () => {
    const service = new VideoService(
      {
        isDbConnected: false,
        inMemoryCourses: [
          {
            id: 'course-javascript-2026',
            modules: [
              {
                lessons: [
                  {
                    id: 'javascript-lesson-01',
                    title: 'Course Introduction',
                    isFreePreview: true,
                    videoAssetRef: 'youtube:qz3dH9RdvoM',
                  },
                ],
              },
            ],
          },
        ],
        inMemoryEnrollments: [],
        inMemorySubscriptions: [],
      } as any,
      { get: vi.fn() } as any,
    );

    const result = await service.generateSignedPlaybackToken(
      null,
      'javascript-lesson-01',
    );

    expect(result.provider).toBe('YOUTUBE');
    expect(result.videoAvailable).toBe(true);
    expect(result.embedUrl).toBe(
      'https://www.youtube-nocookie.com/embed/qz3dH9RdvoM?rel=0&modestbranding=1&playsinline=1',
    );
    expect(result.embedUrl).not.toContain('playlist');
  });
});

describe('VideoService - paid lesson access', () => {
  const makeService = () =>
    new VideoService(
      {
        isDbConnected: false,
        inMemoryCourses: [
          {
            id: 'course-draft',
            modules: [
              {
                lessons: [
                  {
                    id: 'paid-lesson',
                    title: 'Paid lesson',
                    isFreePreview: false,
                    videoAssetRef: 'youtube:qz3dH9RdvoM',
                  },
                ],
              },
            ],
          },
        ],
        inMemoryEnrollments: [],
        inMemorySubscriptions: [],
        inMemoryMembershipPlans: [],
      } as any,
      { get: vi.fn() } as any,
    );

  it('blocks a signed-in student who is not enrolled', async () => {
    await expect(
      makeService().generateSignedPlaybackToken('student-1', 'paid-lesson'),
    ).rejects.toThrow('You must enroll');
  });

  it('lets an admin review a paid lesson without enrolling', async () => {
    const result = await makeService().generateSignedPlaybackToken(
      'admin-1',
      'paid-lesson',
      true,
    );
    expect(result.videoAvailable).toBe(true);
  });
});
