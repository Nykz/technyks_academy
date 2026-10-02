import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { CouponsService } from '../coupons/coupons.service';
import { TemplatesModule } from '../templates/templates.module';
import { FxModule } from '../fx/fx.module';

@Module({
  imports: [TemplatesModule, FxModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, CouponsService],
  exports: [PaymentsService, CouponsService],
})
export class PaymentsModule {}
