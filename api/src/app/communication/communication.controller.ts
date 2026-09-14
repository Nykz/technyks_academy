import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CommunicationService } from './communication.service';

@Controller('communication')
@UseGuards(JwtAuthGuard)
export class CommunicationController {
  constructor(private communicationService: CommunicationService) {}

  @Get('courses/:courseId/questions')
  listQuestions(
    @Request() req: any,
    @Param('courseId') courseId: string,
    @Query('lessonId') lessonId?: string,
    @Query('scope') scope?: string,
  ) {
    return this.communicationService.listQuestions(
      req.user,
      courseId,
      scope === 'CURRENT' ? lessonId : undefined,
    );
  }

  @Post('courses/:courseId/questions')
  createQuestion(
    @Request() req: any,
    @Param('courseId') courseId: string,
    @Body() dto: { lessonId?: string; title?: string; body?: string },
  ) {
    return this.communicationService.createQuestion(req.user, courseId, dto);
  }

  @Post('questions/:questionId/replies')
  createReply(
    @Request() req: any,
    @Param('questionId') questionId: string,
    @Body() dto: { body?: string },
  ) {
    return this.communicationService.createReply(req.user, questionId, dto);
  }

  @Get('courses/:courseId/announcements')
  listAnnouncements(@Request() req: any, @Param('courseId') courseId: string) {
    return this.communicationService.listAnnouncementsForCourse(
      req.user,
      courseId,
    );
  }
}

@Controller('admin/communication')
@UseGuards(JwtAuthGuard, RolesGuard)
@SetMetadata('roles', ['ADMIN'])
export class AdminCommunicationController {
  constructor(private communicationService: CommunicationService) {}

  @Get('questions')
  listQuestions(
    @Request() req: any,
    @Query('courseId') courseId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.communicationService.listQuestionsForAdmin(req.user, {
      courseId,
      status,
      search,
    });
  }

  @Post('questions/:questionId/replies')
  reply(
    @Request() req: any,
    @Param('questionId') questionId: string,
    @Body() dto: { body?: string },
  ) {
    return this.communicationService.createReply(req.user, questionId, dto);
  }

  @Patch('questions/:questionId/status')
  updateStatus(
    @Param('questionId') questionId: string,
    @Body() dto: { status?: string },
  ) {
    return this.communicationService.updateQuestionStatus(
      questionId,
      dto.status,
    );
  }

  @Get('announcements')
  listAnnouncements() {
    return this.communicationService.listAnnouncementsForAdmin();
  }

  @Get('email-configuration')
  getEmailConfiguration() {
    return this.communicationService.getEmailConfiguration();
  }

  @Post('announcements')
  createAnnouncement(
    @Request() req: any,
    @Body()
    dto: {
      title?: string;
      body?: string;
      targetCourseIds?: string[];
      sendEmail?: boolean;
    },
  ) {
    return this.communicationService.createAnnouncement(req.user.id, dto);
  }

  @Delete('announcements/:id')
  deleteAnnouncement(@Param('id') id: string) {
    return this.communicationService.deleteAnnouncement(id);
  }
}
