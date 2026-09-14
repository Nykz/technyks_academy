import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  SetMetadata,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminService } from './admin.service';
import { MediaService } from './media.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private mediaService: MediaService,
  ) {}

  @Get('metrics')
  async getMetrics() {
    return this.adminService.getRevenueMetrics();
  }

  @Get('students')
  async searchStudents(@Query('search') search?: string) {
    return this.adminService.searchStudents(search);
  }

  @Get('contacts')
  async getContactMessages() {
    return this.adminService.getContactMessages();
  }

  @Patch('contacts/:id')
  async updateContactMessage(
    @Param('id') id: string,
    @Body() dto: { status?: string },
  ) {
    return this.adminService.updateContactMessageStatus(id, dto.status);
  }

  @Delete('contacts/:id')
  async deleteContactMessage(@Param('id') id: string) {
    return this.adminService.deleteContactMessage(id);
  }

  @Get('courses')
  async getCourses() {
    return this.adminService.getAllCourses();
  }

  @Get('courses/:id')
  async getCourse(@Param('id') id: string) {
    return this.adminService.getCourseById(id);
  }

  @Get('courses/:id/students')
  async getCourseStudents(
    @Param('id') id: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getCourseStudents(id, search);
  }

  @Post('media/:kind')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 250 * 1024 * 1024 } }),
  )
  async uploadMedia(
    @Param('kind') kind: 'image' | 'video',
    @UploadedFile() file: any,
  ) {
    return this.mediaService.store(kind, file);
  }

  @Delete('media')
  async removeMedia(@Query('url') url: string) {
    return this.mediaService.remove(url);
  }

  @Get('membership/plans')
  async getMembershipPlans() {
    return this.adminService.getMembershipPlans();
  }

  @Post('membership/plans')
  async createMembershipPlan(@Body() dto: any) {
    return this.adminService.createMembershipPlan(dto);
  }

  @Patch('membership/plans/:id')
  async updateMembershipPlan(@Param('id') id: string, @Body() dto: any) {
    return this.adminService.updateMembershipPlan(id, dto);
  }

  @Delete('membership/plans/:id')
  async deleteMembershipPlan(@Param('id') id: string) {
    return this.adminService.deleteMembershipPlan(id);
  }

  @Post('courses')
  async createCourse(@Body() dto: any) {
    return this.adminService.createCourse(dto);
  }

  @Post('courses/import-javascript')
  async importJavascriptCourse() {
    return this.adminService.importJavascriptCourse();
  }

  @Patch('courses/:id')
  async updateCourse(@Param('id') id: string, @Body() dto: any) {
    return this.adminService.updateCourse(id, dto);
  }

  @Delete('courses/:id')
  async deleteCourse(@Param('id') id: string) {
    return this.adminService.deleteCourse(id);
  }

  @Get('coupons')
  async getCoupons() {
    return this.adminService.getAllCoupons();
  }

  @Get('courses/:id/coupon')
  async getCourseCoupon(@Param('id') id: string) {
    return this.adminService.getCourseCoupon(id);
  }

  @Patch('courses/:id/coupon')
  async saveCourseCoupon(@Param('id') id: string, @Body() dto: any) {
    return this.adminService.saveCourseCoupon(id, dto);
  }

  @Post('coupons')
  async createCoupon(@Body() dto: any) {
    return this.adminService.createCoupon(dto);
  }

  @Patch('coupons/:id')
  async updateCoupon(@Param('id') id: string, @Body() dto: any) {
    return this.adminService.updateCoupon(id, dto);
  }

  @Delete('coupons/:id')
  async deleteCoupon(@Param('id') id: string) {
    return this.adminService.deleteCoupon(id);
  }
}
