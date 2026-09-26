import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import {
  AdminTemplatesController,
  TemplatesController,
} from './templates.controller';
import { TemplatesService } from './templates.service';
import { LargeUploadController } from './large-upload.controller';
import { LargeUploadService } from './large-upload.service';

@Module({
  imports: [PrismaModule],
  controllers: [TemplatesController, AdminTemplatesController, LargeUploadController],
  providers: [TemplatesService, LargeUploadService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
