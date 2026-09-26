import {
  Body,
  Controller,
  Delete,
  Param,
  Post,
  Put,
  Query,
  Req,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { LargeUploadService } from './large-upload.service';

/**
 * Piece-by-piece upload for large admin files:
 *   POST   /api/admin/uploads              { purpose, fileName, size, templateId? }
 *   PUT    /api/admin/uploads/:id?offset=N  raw bytes (application/octet-stream)
 *   POST   /api/admin/uploads/:id/finish
 *   DELETE /api/admin/uploads/:id
 */
@Controller('admin/uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
@SetMetadata('roles', ['ADMIN'])
export class LargeUploadController {
  constructor(private readonly uploads: LargeUploadService) {}

  @Post()
  start(
    @Body()
    body: { purpose?: string; fileName?: string; size?: number; templateId?: string },
  ) {
    return this.uploads.start(body);
  }

  @Put(':id')
  append(@Param('id') id: string, @Query('offset') offset: string, @Req() request: Request) {
    return this.uploads.appendChunk(id, offset, request.body);
  }

  @Post(':id/finish')
  finish(@Param('id') id: string) {
    return this.uploads.finish(id);
  }

  @Delete(':id')
  discard(@Param('id') id: string) {
    return this.uploads.discard(id);
  }
}
