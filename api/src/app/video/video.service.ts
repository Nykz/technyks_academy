import { ServiceUnavailableException } from '@nestjs/common';
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VideoService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async generateSignedPlaybackToken(userId: string | null, lessonId: string) {
    let lesson: any = null;
    let usingDatabase = false;

    if (this.prisma.isDbConnected) {
      try {
        lesson = await this.prisma.lesson.findUnique({
          where: { id: lessonId },
          include: { module: { include: { course: true } } },
        });
        usingDatabase = true;
      } catch {
        throw new ServiceUnavailableException('Your data could not be loaded or saved. Please retry shortly.');
      }
    }

    if (!lesson && !usingDatabase) {
      for (const course of this.prisma.inMemoryCourses) {
        for (const module of course.modules || []) {
          const found = (module.lessons || []).find(
            (candidate: any) => candidate.id === lessonId,
          );
          if (found) {
            lesson = { ...found, module: { courseId: course.id, course } };
            break;
          }
        }
        if (lesson) break;
      }
    }

    if (!lesson) {
      throw new NotFoundException('Lesson not found.');
    }

    // Check authorization: Free Preview OR Enrolled OR Active Subscription
    if (!lesson.isFreePreview) {
      if (!userId) {
        throw new ForbiddenException(
          'Authentication required to view this paid lesson.',
        );
      }

      let enrollment: any = null;
      let activeSub: any = null;

      if (usingDatabase) {
        try {
          enrollment = await this.prisma.enrollment.findUnique({
            where: {
              userId_courseId: { userId, courseId: lesson.module.courseId },
            },
          });
          activeSub = enrollment ? null : await this.prisma.subscription.findFirst({
            where: { userId, status: 'ACTIVE', currentPeriodEnd: { gt: new Date() } },
            include: { plan: { include: { courseAccess: true } } },
          });
        } catch {
        throw new ServiceUnavailableException('Your data could not be loaded or saved. Please retry shortly.');
        }
      }

      if (!enrollment && !usingDatabase) {
        enrollment = this.prisma.inMemoryEnrollments.find(
          (item) =>
            item.userId === userId && item.courseId === lesson.module.courseId,
        );
      }
      if (!activeSub && !usingDatabase) {
        activeSub = this.prisma.inMemorySubscriptions.find(
          (item) => item.userId === userId && item.status === 'ACTIVE',
        );
      }

      const membershipHasAccess = this.hasMembershipCourseAccess(
        activeSub,
        lesson.module.courseId,
      );

      if (!enrollment && !membershipHasAccess) {
        throw new ForbiddenException(
          'You must enroll in this course or join a membership plan that includes it.',
        );
      }
    }

    const bunnyLibraryId = this.config
      .get<string>('BUNNY_STREAM_LIBRARY_ID')
      ?.trim();
    const bunnyTokenKey = this.config
      .get<string>('BUNNY_STREAM_TOKEN_KEY')
      ?.trim();
    const bunnyEnabled =
      this.config.get<string>('BUNNY_STREAM_ENABLED')?.toLowerCase() === 'true';
    const expires = Math.floor(Date.now() / 1000) + 3600 * 4; // Token expires in 4 hours
    const videoReference = String(lesson.videoAssetRef || '').trim();
    const youtubeVideoId = this.extractYoutubeVideoId(videoReference);

    // YouTube Membership lessons are protected by the same course/enrollment
    // check above. The unlisted reference is resolved only after authorization
    // and is never returned from the public course endpoints.
    if (youtubeVideoId) {
      return {
        lessonId: lesson.id,
        title: lesson.title,
        isFreePreview: lesson.isFreePreview,
        provider: 'YOUTUBE',
        videoAvailable: true,
        embedUrl: `https://www.youtube-nocookie.com/embed/${youtubeVideoId}?rel=0&modestbranding=1&playsinline=1`,
        expires: 0,
        token: null,
      };
    }

    const videoId = videoReference;

    // Bunny is intentionally optional until the owner supplies real account
    // credentials and attaches a real video ID to each lesson.
    if (
      !bunnyEnabled ||
      !videoId ||
      /^demo(?:[_-]|$)/i.test(videoId) ||
      !bunnyLibraryId ||
      !bunnyTokenKey
    ) {
      return {
        lessonId: lesson.id,
        title: lesson.title,
        isFreePreview: lesson.isFreePreview,
        provider: null,
        videoAvailable: false,
        embedUrl: null,
        expires: 0,
        token: null,
      };
    }

    // Bunny Stream SHA-256 Token Authentication Hash calculation:
    // hash = sha256(tokenKey + videoId + expires)
    const hashable = `${bunnyTokenKey}${videoId}${expires}`;
    const token = crypto.createHash('sha256').update(hashable).digest('hex');

    // Secure tokenized embed URL (never direct raw MP4 URL!)
    const embedUrl = `https://iframe.mediadelivery.net/embed/${bunnyLibraryId}/${videoId}?token=${token}&expires=${expires}&autoplay=true`;

    return {
      lessonId: lesson.id,
      title: lesson.title,
      isFreePreview: lesson.isFreePreview,
      provider: 'BUNNY',
      videoAvailable: true,
      embedUrl,
      expires,
      token,
    };
  }

  private extractYoutubeVideoId(reference: string): string | null {
    const value = reference.trim();
    const isVideoId = (candidate: string | null | undefined) =>
      candidate && /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;

    if (value.toLowerCase().startsWith('youtube:')) {
      return isVideoId(value.slice('youtube:'.length));
    }

    const directId = isVideoId(value);
    if (directId) return directId;

    try {
      const url = new URL(value);
      if (url.hostname === 'youtu.be')
        return isVideoId(url.pathname.split('/').filter(Boolean)[0]);
      if (
        url.hostname === 'youtube.com' ||
        url.hostname.endsWith('.youtube.com')
      ) {
        if (url.pathname === '/watch')
          return isVideoId(url.searchParams.get('v'));
        const pathMatch = url.pathname.match(
          /^\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})/,
        );
        return isVideoId(pathMatch?.[1]);
      }
    } catch {
      // Invalid or unsupported references fall through to Bunny handling.
    }

    return null;
  }

  private hasMembershipCourseAccess(subscription: any, courseId: string): boolean {
    if (!subscription || subscription.status !== 'ACTIVE' ||
      !subscription.currentPeriodEnd || new Date(subscription.currentPeriodEnd).getTime() <= Date.now()) return false;
    const plan = subscription.plan || this.prisma.inMemoryMembershipPlans.find(
      (candidate) => candidate.id === subscription.planId,
    );
    if (!plan) return false;
    if (plan.accessAllCourses === true) return true;
    return (plan.courseAccess || []).some(
      (access: any) => (access.courseId || access) === courseId,
    );
  }
}
