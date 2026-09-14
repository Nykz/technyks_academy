import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Request,
  SetMetadata,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createReadStream } from 'node:fs';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { TemplatesService } from './templates.service';

const Roles = (...roles: string[]) => SetMetadata('roles', roles);

@Controller('templates')
export class TemplatesController {
  constructor(private templatesService: TemplatesService) {}

  @Get()
  list() {
    return this.templatesService.listPublic();
  }

  @UseGuards(JwtAuthGuard)
  @Get('purchases/my')
  myPurchases(@Request() request: any) {
    return this.templatesService.listPurchases(request.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/download')
  @Header('Cache-Control', 'private, no-store')
  async download(@Request() request: any, @Param('id') id: string) {
    const file = await this.templatesService.getPurchasedFile(
      request.user.id,
      id,
    );
    return new StreamableFile(createReadStream(file.path), {
      type: 'application/zip',
      disposition: `attachment; filename="${file.downloadName}"`,
      length: file.size,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/delivery')
  @Header('Cache-Control', 'private, no-store')
  delivery(@Request() request: any, @Param('id') id: string) {
    return this.templatesService.getPurchasedDelivery(request.user.id, id);
  }

  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.templatesService.getPublicBySlug(slug);
  }
}

@Controller('admin/templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminTemplatesController {
  constructor(private templatesService: TemplatesService) {}

  @Get()
  list() {
    return this.templatesService.listAdmin();
  }

  @Get('orders')
  orders() {
    return this.templatesService.listOrders();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.templatesService.getAdmin(id);
  }

  @Post()
  create(@Body() body: any) {
    return this.templatesService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.templatesService.update(id, body);
  }

  @Post(':id/file')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }),
  )
  uploadFile(@Param('id') id: string, @UploadedFile() file: any) {
    return this.templatesService.storeProductFile(id, file);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.templatesService.remove(id);
  }
}
