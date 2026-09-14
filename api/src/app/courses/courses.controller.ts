import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/guards';

@Controller('courses')
export class CoursesController {
  constructor(
    private coursesService: CoursesService,
    private reviewsService: ReviewsService,
  ) {}

  @Get()
  async getAllCourses() {
    return this.coursesService.findAllPublished();
  }

  @Get('by-id/:id')
  async getCourseById(@Param('id') id: string) {
    return this.coursesService.findBySlug(id, true);
  }

  @Get(':slug')
  async getCourseBySlug(@Param('slug') slug: string) {
    return this.coursesService.findBySlug(slug);
  }

  @Get(':slug/reviews')
  async getCourseReviews(@Param('slug') slug: string) {
    return this.coursesService.getReviewsBySlug(slug);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':courseId/reviews')
  async saveCourseReview(
    @Request() req: any,
    @Param('courseId') courseId: string,
    @Body() dto: { rating?: number; comment?: string },
  ) {
    return this.reviewsService.upsertReview(req.user.id, courseId, dto);
  }
}
