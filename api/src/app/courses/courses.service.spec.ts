import { describe, expect, it } from 'vitest';
import { CoursesService } from './courses.service';

describe('CoursesService - public course safety', () => {
  it('seeds the TypeScript curriculum into API persistence for public and admin use', async () => {
    const prisma = {
      isDbConnected: false,
      inMemoryCourses: [],
      inMemoryReviews: [],
    } as any;
    const service = new CoursesService(prisma);

    await service.onModuleInit();

    const typeScriptCourse = prisma.inMemoryCourses.find(
      (course: any) => course.id === 'course-typescript-2026',
    );
    expect(typeScriptCourse).toBeDefined();
    expect(typeScriptCourse.isPublished).toBe(true);
    expect(typeScriptCourse.modules).toHaveLength(9);
    expect(
      typeScriptCourse.modules.flatMap((module: any) => module.lessons),
    ).toHaveLength(37);
  });

  it('removes private video references from a public course response', async () => {
    const service = new CoursesService({
      isDbConnected: false,
      inMemoryCourses: [
        {
          id: 'course-javascript-2026',
          slug: 'complete-javascript-course',
          isPublished: true,
          modules: [
            {
              id: 'javascript-section-1',
              title: 'Course Orientation',
              lessons: [
                {
                  id: 'javascript-lesson-01',
                  title: 'Introduction',
                  videoAssetRef: 'youtube:private-id',
                },
              ],
            },
          ],
        },
      ],
    } as any);

    const result = await service.findBySlug('complete-javascript-course');

    expect(result.modules[0].lessons[0]).not.toHaveProperty('videoAssetRef');
    expect(result.modules[0].lessons[0].title).toBe('Introduction');
  });
});

describe('CoursesService - Bunny intro video', () => {
  it('adds a signed player URL for a Bunny intro to the public course', async () => {
    process.env['BUNNY_STREAM_ENABLED'] = 'true';
    process.env['BUNNY_STREAM_LIBRARY_ID'] = '750648';
    process.env['BUNNY_STREAM_TOKEN_KEY'] = 'token-key';
    const id = '3fc629df-fa2b-4797-b684-bf23e4cdac1c';
    const service = new CoursesService({
      isDbConnected: false,
      inMemoryReviews: [],
      inMemoryCourses: [
        {
          id: 'c-ai',
          slug: 'ai-receptionist',
          title: 'AI Receptionist',
          isPublished: true,
          isArchived: false,
          promoVideoUrl: `bunny:${id}`,
          modules: [],
        },
      ],
    } as any);

    const course: any = await service.findBySlug('ai-receptionist');

    expect(course.promoVideoUrl).toBe(`bunny:${id}`);
    expect(course.promoEmbedUrl.startsWith(
      `https://iframe.mediadelivery.net/embed/750648/${id}?token=`,
    )).toBe(true);
    expect(course.promoEmbedUrl).toMatch(/\?token=[a-f0-9]{64}&expires=\d+&autoplay=false$/);
  });
});
