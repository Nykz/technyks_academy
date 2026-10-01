import {
  Body,
  Controller,
  Delete,
  Get,
  Module,
  Patch,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards';
import { MediaService } from '../admin/media.service';
import { AccountService } from './account.service';

@Controller('account')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get()
  profile(@Request() req: any) {
    return this.account.getProfile(req.user.id);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Patch('profile')
  updateProfile(@Request() req: any, @Body() dto: any) {
    return this.account.updateProfile(req.user.id, dto || {});
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Patch('notifications')
  updateNotifications(@Request() req: any, @Body() dto: any) {
    return this.account.updateNotifications(req.user.id, dto || {});
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 3 * 1024 * 1024, files: 1 } }))
  uploadAvatar(@Request() req: any, @UploadedFile() file: any) {
    return this.account.uploadAvatar(req.user.id, file);
  }

  @Delete('avatar')
  removeAvatar(@Request() req: any) {
    return this.account.removeAvatar(req.user.id);
  }

  // Tight limit: this endpoint checks the current password.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password')
  changePassword(@Request() req: any, @Body() dto: any) {
    return this.account.changePassword(req.user.id, dto || {});
  }

  @Get('purchases')
  purchases(@Request() req: any) {
    return this.account.purchases(req.user.id);
  }
}

@Module({
  controllers: [AccountController],
  providers: [AccountService, MediaService],
})
export class AccountModule {}
