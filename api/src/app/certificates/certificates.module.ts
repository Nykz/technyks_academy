import { Controller, Get, Module, Param, Query, Request, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards';
import { CertificatesService } from './certificates.service';

@Controller('certificates')
export class CertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @UseGuards(JwtAuthGuard)
  @Get('my')
  mine(@Request() req: any) {
    return this.certificates.listForUser(req.user.id);
  }

  /** Public: the verification page shows who earned it and for which course. */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('verify/:number')
  verify(@Param('number') number: string) {
    return this.certificates.verify(number);
  }

  /** Public PDF, e.g. /api/certificates/download/TA-7K2M-9QXD-4HPW.pdf */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('download/:file')
  async download(
    @Param('file') file: string,
    @Query('download') download: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.certificates.pdf(file.replace(/\.pdf$/i, ''));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `${download ? 'attachment' : 'inline'}; filename="${filename}"`,
    );
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
  }
}

@Module({
  controllers: [CertificatesController],
  providers: [CertificatesService],
  exports: [CertificatesService],
})
export class CertificatesModule {}
