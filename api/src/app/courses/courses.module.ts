import { Module } from '@nestjs/common';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { ReviewsService } from './reviews.service';
import { AdminReviewsController } from './admin-reviews.controller';

@Module({
  controllers: [CoursesController, AdminReviewsController],
  providers: [CoursesService, ReviewsService],
  exports: [CoursesService, ReviewsService],
})
export class CoursesModule {}
