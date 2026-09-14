import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import {
  AdminTemplatesController,
  TemplatesController,
} from './templates.controller';
import { TemplatesService } from './templates.service';

@Module({
  imports: [PrismaModule],
  controllers: [TemplatesController, AdminTemplatesController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
