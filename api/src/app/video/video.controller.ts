import { Throttle } from '@nestjs/throttler';
import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { VideoService } from './video.service';
import { OptionalJwtAuthGuard } from '../auth/guards';

@Controller('video')
export class VideoController {
  constructor(private videoService: VideoService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('token/:lessonId')
  async getSignedPlaybackToken(@Request() req: any, @Param('lessonId') lessonId: string) {
    return this.videoService.generateSignedPlaybackToken(
      req.user?.id || null,
      lessonId,
      req.user?.role === 'ADMIN',
    );
  }
}
