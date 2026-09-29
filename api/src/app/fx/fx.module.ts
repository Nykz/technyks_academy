import { Controller, Get, Injectable, Logger, Module } from '@nestjs/common';

const SOURCE = 'https://open.er-api.com/v6/latest/INR';
const REFRESH_MS = 12 * 60 * 60 * 1000;

export interface FxRates {
  base: 'INR';
  /** 1 INR expressed in each currency, e.g. rates.USD = 0.0117. */
  rates: Record<string, number>;
  updatedAt: string | null;
}

/**
 * Exchange rates for showing prices in a visitor's own currency. Payments
 * are always charged in INR; these rates are for display only. Rates are
 * fetched at most every 12 hours and the last good copy is kept if the
 * source is unavailable.
 */
@Injectable()
export class FxService {
  private readonly logger = new Logger(FxService.name);
  private cache: FxRates = { base: 'INR', rates: { INR: 1 }, updatedAt: null };
  private fetchedAt = 0;
  private pending: Promise<void> | null = null;

  async rates(): Promise<FxRates> {
    if (Date.now() - this.fetchedAt > REFRESH_MS) {
      this.pending ??= this.refresh().finally(() => (this.pending = null));
      await this.pending;
    }
    return this.cache;
  }

  private async refresh() {
    try {
      const response = await fetch(SOURCE, { signal: AbortSignal.timeout(5000) });
      const body: any = await response.json();
      if (body?.result !== 'success' || typeof body.rates !== 'object') {
        throw new Error('unexpected response');
      }
      const rates: Record<string, number> = {};
      for (const [code, value] of Object.entries(body.rates)) {
        if (/^[A-Z]{3}$/.test(code) && Number(value) > 0) rates[code] = Number(value);
      }
      this.cache = { base: 'INR', rates: { ...rates, INR: 1 }, updatedAt: new Date().toISOString() };
      this.fetchedAt = Date.now();
    } catch (error: any) {
      // Try again in 10 minutes rather than on every request.
      this.fetchedAt = Date.now() - REFRESH_MS + 10 * 60 * 1000;
      this.logger.warn(`Exchange rates unavailable: ${error?.message || error}`);
    }
  }
}

@Controller('fx')
export class FxController {
  constructor(private readonly fx: FxService) {}

  @Get()
  rates() {
    return this.fx.rates();
  }
}

@Module({
  controllers: [FxController],
  providers: [FxService],
})
export class FxModule {}
