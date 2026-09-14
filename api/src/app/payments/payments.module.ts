import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { CouponsService } from '../coupons/coupons.service';
import { TemplatesModule } from '../templates/templates.module';

@Module({
  imports: [TemplatesModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, CouponsService],
  exports: [PaymentsService, CouponsService],
})
export class PaymentsModule {}
