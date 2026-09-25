import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CoursesModule } from './courses/courses.module';
import { PaymentsModule } from './payments/payments.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { VideoModule } from './video/video.module';
import { AdminModule } from './admin/admin.module';
import { ContactModule } from './contact/contact.module';
import { SiteSettingsModule } from './site-settings/site-settings.module';
import { CommunicationModule } from './communication/communication.module';
import { TemplatesModule } from './templates/templates.module';
import { MailModule } from './mail/mail.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // App-wide default rate limit; individual auth endpoints tighten this
    // further with their own @Throttle() overrides (see auth.controller.ts).
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    PrismaModule,
    MailModule,
    AuthModule,
    CoursesModule,
    PaymentsModule,
    EnrollmentsModule,
    VideoModule,
    AdminModule,
    ContactModule,
    SiteSettingsModule,
    CommunicationModule,
    TemplatesModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
