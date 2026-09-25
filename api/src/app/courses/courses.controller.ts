import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../auth/guards';

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

  // Admins may open unpublished (draft) courses to review them.
  @UseGuards(OptionalJwtAuthGuard)
  @Get('by-id/:id')
  async getCourseById(@Request() req: any, @Param('id') id: string) {
    return this.coursesService.findBySlug(id, true, req.user?.role === 'ADMIN');
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':slug')
  async getCourseBySlug(@Request() req: any, @Param('slug') slug: string) {
    return this.coursesService.findBySlug(slug, false, req.user?.role === 'ADMIN');
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
