import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Param,
  Res,
} from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { JwtAuthGuard } from '../auth/guards';

@Controller('enrollments')
export class EnrollmentsController {
  constructor(private enrollmentsService: EnrollmentsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('my')
  async getMyEnrollments(@Request() req: any) {
    return this.enrollmentsService.getMyEnrollments(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('access/:courseId')
  async getCourseAccess(
    @Request() req: any,
    @Param('courseId') courseId: string,
  ) {
    return this.enrollmentsService.getCourseAccess(req.user.id, courseId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('free')
  async enrollInFreeCourse(
    @Request() req: any,
    @Body() dto: { courseId: string },
  ) {
    return this.enrollmentsService.enrollInFreeCourse(
      req.user.id,
      dto.courseId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('progress')
  async updateProgress(
    @Request() req: any,
    @Body() dto: { courseId: string; lessonId: string; isCompleted?: boolean },
  ) {
    return this.enrollmentsService.updateProgress(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('certificate/:courseId')
  async getCertificate(
    @Request() req: any,
    @Param('courseId') courseId: string,
  ) {
    return this.enrollmentsService.generateCertificateIfEligible(
      req.user.id,
      courseId,
    );
  }
}
