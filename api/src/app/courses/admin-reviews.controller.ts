import {
  Controller,
  Delete,
  Get,
  Param,
  Query,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { ReviewsService } from './reviews.service';

@Controller('admin/reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
@SetMetadata('roles', ['ADMIN'])
export class AdminReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  list(
    @Query('search') search?: string,
    @Query('courseId') courseId?: string,
    @Query('rating') rating?: string,
  ) {
    return this.reviewsService.listForAdmin({
      search,
      courseId,
      rating: rating ? Number(rating) : undefined,
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.reviewsService.deleteReview(id);
  }
}
