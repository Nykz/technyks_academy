import { Pipe, PipeTransform, inject } from '@angular/core';
import { LocalPriceService } from '../services/local-price.service';

/**
 * `{{ course.price | localPrice }}` shows an INR price in the visitor's
 * currency (rupees in India). Impure so it updates once exchange rates load;
 * formatting is cheap.
 */
@Pipe({ name: 'localPrice', pure: false })
export class LocalPricePipe implements PipeTransform {
  private readonly prices = inject(LocalPriceService);

  transform(amount: number | null | undefined, currency = 'INR'): string {
    return this.prices.format(amount, currency);
  }
}
