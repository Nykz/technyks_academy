import {
  Injectable,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JAVASCRIPT_COURSE } from './javascript-course.data';
import { TYPESCRIPT_COURSE } from './typescript-course.data';

const PUBLIC_REVIEW_INCLUDE = {
  user: {
    select: {
      name: true,
      avatarUrl: true,
    },
  },
};

const INITIAL_COURSES = [
  JAVASCRIPT_COURSE,
  TYPESCRIPT_COURSE,
  {
    id: 'course_1',
    slug: 'mastering-agentic-ai',
    title: 'Mastering Agentic AI & Autonomous Workflows',
    subtitle:
      'Build enterprise-grade multi-agent systems, tool-calling pipelines, and autonomous AI agents.',
    description:
      'Deep dive into the architecture of modern AI agents. Learn state management, tool execution, long-term memory, fallback routines, and multi-agent coordination using NestJS and Python.',
    price: 4999,
    currency: 'INR',
    level: 'Advanced',
    category: 'AI & Agents',
    isPublished: true,
    thumbnail: '/assets/course-agentic-ai.png',
    modules: [
      {
        id: 'mod_1',
        title: 'Module 1: Foundations of Agentic Systems',
        order: 1,
        lessons: [
          {
            id: 'les_1',
            title: '1.1 Paradigm Shift: Chains vs Autonomous Agents',
            duration: 900,
            order: 1,
            isFreePreview: true,
            videoAssetRef: null,
          },
          {
            id: 'les_2',
            title: '1.2 ReAct Framework & Thought-Action Loops',
            duration: 1200,
            order: 2,
            isFreePreview: false,
            videoAssetRef: null,
          },
          {
            id: 'les_3',
            title: '1.3 Tool Calling Specs & Schema Enforcement',
            duration: 1500,
            order: 3,
            isFreePreview: false,
            videoAssetRef: null,
          },
        ],
      },
      {
        id: 'mod_2',
        title: 'Module 2: Multi-Agent Orchestration & Memory',
        order: 2,
        lessons: [
          {
            id: 'les_4',
            title: '2.1 Supervisor & Hierarchical Agent Topologies',
            duration: 1800,
            order: 1,
            isFreePreview: false,
            videoAssetRef: null,
          },
          {
            id: 'les_5',
            title: '2.2 Vector Databases, Semantic Search & Epistemic Memory',
            duration: 2100,
            order: 2,
            isFreePreview: false,
            videoAssetRef: null,
          },
        ],
      },
    ],
  },
  {
    id: 'course_2',
    slug: 'architectural-intelligence',
    title: 'Architectural Intelligence & Nx Monorepos',
    subtitle:
      'Master enterprise software architecture, domain-driven design, and Nx monorepo patterns.',
    description:
      'Learn how to structure complex enterprise applications for years of solo or team maintenance. Master Nx boundaries, domain isolation, Angular signals, and resilient NestJS backends.',
    price: 3999,
    currency: 'INR',
    level: 'Intermediate',
    category: 'Software Architecture',
    isPublished: true,
    thumbnail: '/assets/course-mern-rag.png',
    modules: [
      {
        id: 'mod_3',
        title: 'Module 1: Domain-Driven Design in Monorepos',
        order: 1,
        lessons: [
          {
            id: 'les_6',
            title: '1.1 Monorepo Strategy: Apps vs Scope-Based Libraries',
            duration: 1000,
            order: 1,
            isFreePreview: true,
            videoAssetRef: null,
          },
          {
            id: 'les_7',
            title: '1.2 Module Boundaries & Dependency Linting Rules',
            duration: 1400,
            order: 2,
            isFreePreview: false,
            videoAssetRef: null,
          },
        ],
      },
    ],
  },
  {
    id: 'course_3',
    slug: 'full-stack-saas-blueprint',
    title: 'Full-Stack SaaS Architecture & Payments',
    subtitle:
      'Build, monetize, and scale production SaaS platforms with Razorpay and Lemon Squeezy.',
    description:
      'A complete playbook for launching monetized membership platforms. Covers Razorpay Subscriptions (e-mandate / UPI Autopay), Lemon Squeezy Merchant-of-Record integration, JWT auth, and tokenized video hosting.',
    price: 5999,
    currency: 'INR',
    level: 'Advanced',
    category: 'Software Architecture',
    isPublished: true,
    thumbnail: '/assets/course-vibe-coding.png',
    modules: [
      {
        id: 'mod_4',
        title: 'Module 1: Payment Gateways & RBI Compliance',
        order: 1,
        lessons: [
          {
            id: 'les_8',
            title: '1.1 Razorpay UPI Autopay & Pre-debit Notices',
            duration: 1600,
            order: 1,
            isFreePreview: true,
            videoAssetRef: null,
          },
          {
            id: 'les_9',
            title: '1.2 Lemon Squeezy MoR & Global Tax Calculation',
            duration: 1500,
            order: 2,
            isFreePreview: false,
            videoAssetRef: null,
          },
        ],
      },
    ],
  },
];

@Injectable()
export class CoursesService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    // Built-in courses must exist in the API database so they are visible and
    // editable in the admin panel, not only in one browser's local fallback.
    for (const { course, draft } of [
      { course: JAVASCRIPT_COURSE, draft: false },
      { course: TYPESCRIPT_COURSE, draft: false },
    ]) {
      if (this.prisma.isDbConnected) {
        try {
          const existing = await this.prisma.course.findUnique({
            where: { id: course.id },
            include: { modules: { include: { lessons: true } } },
          });

          if (!existing) {
            await this.prisma.course.create({
              data: this.toPrismaCourseCreateData(course, draft) as any,
            });
          } else if (!existing.isArchived) {
            const repairs: Record<string, unknown> = {};
            const isMissingCurriculum = !this.hasCurriculum(existing);
            const hasLegacyLevel = ![
              'Beginner',
              'Intermediate',
              'Advanced',
              'All Levels',
            ].includes(existing.level);
            if (isMissingCurriculum) {
              // Preserve administrator-authored landing-page data while repairing
              // the missing built-in curriculum.
              repairs['modules'] = {
                create: this.toPrismaModules(course.modules),
              };
            }
            if (hasLegacyLevel) {
              repairs['level'] = course.level;
            }
            if (
              course.isPublished &&
              !existing.isPublished &&
              (isMissingCurriculum || hasLegacyLevel)
            ) {
              repairs['isPublished'] = true;
            }
            if (Object.keys(repairs).length) {
              await this.prisma.course.update({
                where: { id: course.id },
                data: repairs as any,
              });
            }
          }
          continue;
        } catch {
          // Keep the application available through the local adapter during a
          // transient database failure.
        }
      }

      const existing = this.prisma.inMemoryCourses.find(
        (candidate) => candidate.id === course.id,
      );
      if (existing) {
        const isMissingCurriculum = !this.hasCurriculum(existing);
        if (!existing.isArchived && isMissingCurriculum) {
          existing.modules = course.modules;
          existing.updatedAt = new Date();
        }
        const hasLegacyLevel = ![
          'Beginner',
          'Intermediate',
          'Advanced',
          'All Levels',
        ].includes(existing.level);
        if (!existing.isArchived && hasLegacyLevel) {
          existing.level = course.level;
        }
        if (
          !existing.isArchived &&
          course.isPublished &&
          (isMissingCurriculum || hasLegacyLevel)
        ) {
          existing.isPublished = true;
        }
        continue;
      }

      this.prisma.inMemoryCourses.unshift({
        ...course,
        isPublished: draft ? false : Boolean(course.isPublished),
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  async findAllPublished() {
    if (this.prisma.isDbConnected) {
      try {
        const courses = await this.prisma.course.findMany({
          where: { isPublished: true, isArchived: false },
          include: {
            modules: {
              include: {
                lessons: {
                  select: {
                    id: true,
                    title: true,
                    duration: true,
                    isFreePreview: true,
                    order: true,
                  },
                },
              },
              orderBy: { order: 'asc' },
            },
            reviews: {
              include: PUBLIC_REVIEW_INCLUDE,
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        });
        return courses.map((course) => this.toPublicCourse(course));
      } catch {
        throw new ServiceUnavailableException(
          'Courses could not be loaded. Please retry shortly.',
        );
      }
    }
    return this.prisma.inMemoryCourses
      .filter((course) => course.isPublished && !course.isArchived)
      .map((course) => this.toPublicCourse(course));
  }

  /** includeDrafts lets an admin open an unpublished course to review it. */
  async findBySlug(slug: string, byId = false, includeDrafts = false) {
    if (this.prisma.isDbConnected) {
      try {
        const course = await this.prisma.course.findFirst({
          where: {
            ...(byId ? { id: slug } : { slug }),
            ...(includeDrafts ? {} : { isPublished: true }),
            isArchived: false,
          },
          include: {
            modules: {
              include: {
                lessons: {
                  select: {
                    id: true,
                    title: true,
                    description: true,
                    duration: true,
                    isFreePreview: true,
                    order: true,
                  },
                },
              },
              orderBy: { order: 'asc' },
            },
            reviews: {
              include: PUBLIC_REVIEW_INCLUDE,
              orderBy: { createdAt: 'desc' },
            },
          },
        });
        if (course) return this.toPublicCourse(course);
        throw new NotFoundException(`Course with slug "${slug}" not found.`);
      } catch (e) {
        if (e instanceof NotFoundException) throw e;
        throw new ServiceUnavailableException(
          'This course could not be loaded. Please retry shortly.',
        );
      }
    }

    const found = this.prisma.inMemoryCourses.find(
      (c) =>
        (byId ? c.id === slug : c.slug === slug) &&
        (includeDrafts || c.isPublished) &&
        !c.isArchived,
    );
    if (!found) {
      throw new NotFoundException(`Course with slug "${slug}" not found.`);
    }
    return this.toPublicCourse(found);
  }

  async getReviewsBySlug(slug: string) {
    const course = await this.findBySlug(slug);
    return {
      rating: course.rating || 0,
      reviewCount: course.reviewCount || 0,
      reviews: course.reviews || [],
    };
  }

  private toPublicCourse(course: any) {
    const reviews = Array.isArray(course.reviews)
      ? course.reviews.map((review: any) => this.toPublicReview(review))
      : (this.prisma.inMemoryReviews || [])
          .filter((review) => review.courseId === course.id)
          .sort(
            (a, b) =>
              new Date(b.createdAt || 0).getTime() -
              new Date(a.createdAt || 0).getTime(),
          )
          .map((review) => this.toPublicReview(review));
    const rating = reviews.length
      ? Number(
          (
            reviews.reduce(
              (total: number, review: any) =>
                total + Number(review.rating || 0),
              0,
            ) / reviews.length
          ).toFixed(1),
        )
      : 0;

    return {
      ...course,
      isFree: Boolean(course.isFree ?? Number(course.price || 0) === 0),
      rating,
      reviewCount: reviews.length,
      reviews,
      modules: (course.modules || []).map((module: any) => ({
        ...module,
        lessons: (module.lessons || []).map((lesson: any) => {
          const { videoAssetRef: _privateVideoAssetRef, ...publicLesson } =
            lesson;
          return publicLesson;
        }),
      })),
    };
  }

  private toPublicReview(review: any) {
    return {
      id: review.id,
      rating: Number(review.rating || 0),
      comment: review.comment || '',
      user: {
        name: review.user?.name || 'Student',
        avatarUrl: review.user?.avatarUrl || null,
      },
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    };
  }

  private hasCurriculum(course: any): boolean {
    return (course.modules || []).some(
      (module: any) => (module.lessons || []).length > 0,
    );
  }

  private toPrismaCourseCreateData(course: any, draft = false) {
    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      subtitle: course.subtitle,
      description: course.description,
      thumbnail: course.thumbnail,
      promoVideoUrl: course.promoVideoUrl ?? null,
      price: course.price,
      isFree: Boolean(course.isFree ?? Number(course.price || 0) === 0),
      currency: course.currency,
      level: course.level,
      category: course.category || 'Web Development',
      isPublished: draft ? false : Boolean(course.isPublished),
      isArchived: false,
      modules: { create: this.toPrismaModules(course.modules) },
    };
  }

  private toPrismaModules(modules: any[]) {
    return (modules || []).map((module: any, moduleIndex: number) => ({
      id: module.id,
      title: module.title,
      order: module.order || moduleIndex + 1,
      lessons: {
        create: (module.lessons || []).map(
          (lesson: any, lessonIndex: number) => ({
            id: lesson.id,
            title: lesson.title,
            description: lesson.description ?? null,
            duration: lesson.duration || 0,
            order: lesson.order || lessonIndex + 1,
            isFreePreview: Boolean(lesson.isFreePreview),
            videoAssetRef: lesson.videoAssetRef ?? null,
          }),
        ),
      },
    }));
  }
}
