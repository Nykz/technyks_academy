import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

function describeDatabaseUrl(rawUrl: string | undefined): string {
  try {
    const url = new URL(String(rawUrl || '').trim());
    return (
      `host=${url.hostname} port=${url.port || '3306'} ` +
      `user=${decodeURIComponent(url.username) || '(none)'} ` +
      `database=${url.pathname.replace(/^\//, '') || '(none)'} ` +
      `password=${url.password ? 'set' : 'MISSING'}`
    );
  } catch {
    return 'DATABASE_URL is not a valid URL (special characters in the password must be URL-encoded)';
  }
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  public isDbConnected = false;

  // In-memory fallback stores when the configured database is not running.
  public inMemoryUsers: any[] = [];
  public inMemoryCourses: any[] = [];
  public inMemoryEnrollments: any[] = [];
  public inMemorySubscriptions: any[] = [];
  public inMemoryCoupons: any[] = [];
  public inMemoryCertificates: any[] = [];
  public inMemoryPayments: any[] = [];
  public inMemoryMembershipPlans: any[] = [];
  public inMemoryReviews: any[] = [];
  public inMemoryContactMessages: any[] = [];
  public inMemoryCourseQuestions: any[] = [];
  public inMemoryCourseReplies: any[] = [];
  public inMemoryCourseAnnouncements: any[] = [];
  public inMemoryUiTemplates: any[] = [];
  public inMemoryUiTemplatePurchases: any[] = [];
  public inMemorySiteSettings: any | null = null;

  async onModuleInit() {
    try {
      await this.$connect();
      await this.ensureRuntimeColumns();
      await this.ensureCommunicationTables();
      await this.ensureTemplateStoreTables();
      this.isDbConnected = true;
      this.logger.log(' Connected successfully to MySQL database via Prisma');
    } catch (error: any) {
      this.isDbConnected = false;
      const fallbackAllowed =
        process.env.ALLOW_IN_MEMORY_FALLBACK === 'true' &&
        process.env.NODE_ENV !== 'production';
      if (!fallbackAllowed) {
        // Surface the real cause (Prisma code + message) and where we tried
        // to connect, never the password, so the host's runtime log is
        // enough to diagnose a broken DATABASE_URL or a missing table.
        const reason = String(error?.message || error)
          .replace(/mysql:\/\/[^\s'"`]+/gi, 'mysql://***')
          .trim();
        throw new Error(
          'Database initialization failed. Persistent storage is required; check the database connection and schema. ' +
            `Target: ${describeDatabaseUrl(process.env.DATABASE_URL)}. ` +
            `Cause${error?.code ? ` [${error.code}]` : ''}: ${reason}`,
        );
      }
      this.logger.warn(
        `Configured MySQL database not reachable (${error?.message || 'Connection failed'}). ` +
          `Switching seamlessly to high-performance in-memory persistence layer.`,
      );
    }
  }

  async onModuleDestroy() {
    if (this.isDbConnected) {
      await this.$disconnect();
    }
  }

  private async ensureRuntimeColumns() {
    const additions = [
      {
        table: 'User',
        sql: 'ADD COLUMN `onboardingCompleted` BOOLEAN NOT NULL DEFAULT false',
      },
      { table: 'User', sql: 'ADD COLUMN `learnerGoal` VARCHAR(191) NULL' },
      { table: 'User', sql: 'ADD COLUMN `experienceLevel` VARCHAR(191) NULL' },
      {
        table: 'User',
        sql: 'ADD COLUMN `membershipPreference` VARCHAR(191) NULL',
      },
      {
        table: 'Course',
        sql: "ADD COLUMN `category` VARCHAR(191) NOT NULL DEFAULT 'Web Development'",
      },
      { table: 'Payment', sql: 'ADD COLUMN `templateProductIds` JSON NULL' },
    ];

    for (const addition of additions) {
      try {
        await this.$executeRawUnsafe(
          `ALTER TABLE \`${addition.table}\` ${addition.sql}`,
        );
      } catch (error: any) {
        const databaseCode = String(error?.meta?.code || error?.code || '');
        const message = String(error?.meta?.message || error?.message || '');
        if (
          databaseCode === '1060' ||
          message.includes('Duplicate column name')
        ) {
          continue;
        }
        throw error;
      }
    }
  }

  private async ensureCommunicationTables() {
    const statements = [
      `CREATE TABLE IF NOT EXISTS \`CourseQuestion\` (
        \`id\` VARCHAR(191) NOT NULL,
        \`userId\` VARCHAR(191) NOT NULL,
        \`courseId\` VARCHAR(191) NOT NULL,
        \`lessonId\` VARCHAR(191) NULL,
        \`title\` VARCHAR(240) NOT NULL,
        \`body\` TEXT NOT NULL,
        \`status\` VARCHAR(32) NOT NULL DEFAULT 'OPEN',
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        INDEX \`CourseQuestion_courseId_createdAt_idx\` (\`courseId\`, \`createdAt\`),
        INDEX \`CourseQuestion_lessonId_idx\` (\`lessonId\`),
        INDEX \`CourseQuestion_status_idx\` (\`status\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS \`CourseReply\` (
        \`id\` VARCHAR(191) NOT NULL,
        \`questionId\` VARCHAR(191) NOT NULL,
        \`userId\` VARCHAR(191) NOT NULL,
        \`body\` TEXT NOT NULL,
        \`isInstructor\` BOOLEAN NOT NULL DEFAULT false,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        INDEX \`CourseReply_questionId_createdAt_idx\` (\`questionId\`, \`createdAt\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS \`CourseAnnouncement\` (
        \`id\` VARCHAR(191) NOT NULL,
        \`createdById\` VARCHAR(191) NOT NULL,
        \`title\` VARCHAR(240) NOT NULL,
        \`body\` TEXT NOT NULL,
        \`targetCourseIds\` JSON NOT NULL,
        \`sendEmail\` BOOLEAN NOT NULL DEFAULT false,
        \`emailStatus\` VARCHAR(32) NOT NULL DEFAULT 'NOT_REQUESTED',
        \`recipientCount\` INT NOT NULL DEFAULT 0,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        INDEX \`CourseAnnouncement_createdAt_idx\` (\`createdAt\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    ];

    for (const statement of statements) {
      await this.$executeRawUnsafe(statement);
    }
  }

  private async ensureTemplateStoreTables() {
    const statements = [
      `CREATE TABLE IF NOT EXISTS \`UiTemplate\` (
        \`id\` VARCHAR(191) NOT NULL,
        \`slug\` VARCHAR(191) NOT NULL,
        \`title\` VARCHAR(191) NOT NULL,
        \`tagline\` VARCHAR(300) NOT NULL,
        \`description\` TEXT NOT NULL,
        \`thumbnail\` TEXT NULL,
        \`promoVideoUrl\` TEXT NULL,
        \`previewUrl\` TEXT NULL,
        \`price\` DOUBLE NOT NULL,
        \`currency\` VARCHAR(16) NOT NULL DEFAULT 'INR',
        \`category\` VARCHAR(120) NOT NULL DEFAULT 'Website UI',
        \`tags\` JSON NOT NULL,
        \`filePath\` TEXT NULL,
        \`fileName\` VARCHAR(255) NULL,
        \`fileSize\` INT NULL,
        \`deliveryUrl\` TEXT NULL,
        \`downloadButtonText\` VARCHAR(80) NOT NULL DEFAULT 'Download files',
        \`buyerMessage\` TEXT NULL,
        \`isPublished\` BOOLEAN NOT NULL DEFAULT false,
        \`isFeatured\` BOOLEAN NOT NULL DEFAULT false,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UiTemplate_slug_key\` (\`slug\`),
        INDEX \`UiTemplate_isPublished_createdAt_idx\` (\`isPublished\`, \`createdAt\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS \`UiTemplatePurchase\` (
        \`id\` VARCHAR(191) NOT NULL,
        \`userId\` VARCHAR(191) NOT NULL,
        \`productId\` VARCHAR(191) NOT NULL,
        \`amount\` DOUBLE NOT NULL,
        \`currency\` VARCHAR(16) NOT NULL DEFAULT 'INR',
        \`paymentId\` VARCHAR(191) NULL,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UiTemplatePurchase_userId_productId_key\` (\`userId\`, \`productId\`),
        INDEX \`UiTemplatePurchase_createdAt_idx\` (\`createdAt\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    ];

    for (const statement of statements) {
      await this.$executeRawUnsafe(statement);
    }

    const additions = [
      'ADD COLUMN `promoVideoUrl` TEXT NULL AFTER `thumbnail`',
      'ADD COLUMN `deliveryUrl` TEXT NULL',
      "ADD COLUMN `downloadButtonText` VARCHAR(80) NOT NULL DEFAULT 'Download files'",
      'ADD COLUMN `buyerMessage` TEXT NULL',
    ];
    for (const addition of additions) {
      try {
        await this.$executeRawUnsafe(`ALTER TABLE \`UiTemplate\` ${addition}`);
      } catch (error: any) {
        const databaseCode = String(error?.meta?.code || error?.code || '');
        const message = String(error?.meta?.message || error?.message || '');
        if (
          databaseCode === '1060' ||
          message.includes('Duplicate column name')
        )
          continue;
        throw error;
      }
    }
  }
}
