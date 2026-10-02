import { CommonModule } from '@angular/common';
import { Component, inject, input, output } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { MediaUrlPipe } from '../../pipes/media-url.pipe';
import { LocalPriceService } from '../../services/local-price.service';
import { TemplateCartService } from '../../services/template-cart.service';
import { UiTemplate } from '../../services/templates.service';

/** UI template card in CodeCanyon's style, used by the store and the home page. */
@Component({
  selector: 'app-template-card',
  standalone: true,
  imports: [CommonModule, RouterModule, MediaUrlPipe],
  host: { class: 'block h-full' },
  template: `
    <article class="group flex h-full flex-col overflow-hidden rounded border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-lg dark:border-white/10 dark:bg-[#121A2B]">
      <a [routerLink]="['/templates', item().slug]" class="relative block aspect-[59/30] overflow-hidden bg-slate-100 dark:bg-[#0B1220]" [attr.aria-label]="item().title">
        @if (item().thumbnail) {
          <img [src]="item().thumbnail | mediaUrl" [alt]="item().title" loading="lazy" class="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]" />
        } @else {
          <!-- No cover yet: a branded placeholder instead of an empty box -->
          <span class="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center" style="background:linear-gradient(135deg,#0b1f4d,#1d4ed8);color:#ffffff">
            <span class="material-symbols-outlined text-4xl opacity-80">web</span>
            <span class="line-clamp-2 font-['Hanken_Grotesk'] text-lg font-bold">{{ item().title }}</span>
            <span class="text-xs uppercase tracking-widest opacity-70">{{ item().category }}</span>
          </span>
        }
        @if (item().isFeatured) {
          <!-- Corner ribbon, like CodeCanyon's sale tag -->
          <span class="absolute left-0 top-0 h-0 w-0 border-r-[44px] border-t-[44px] border-r-transparent" style="border-top-color:#82b440" aria-hidden="true"></span>
          <span class="material-symbols-outlined absolute left-1 top-1 text-base" style="color:#ffffff" aria-hidden="true">star</span>
          <span class="sr-only">Featured</span>
        }
      </a>

      <div class="flex flex-1 flex-col p-4">
        <a [routerLink]="['/templates', item().slug]" class="line-clamp-1 font-bold text-slate-900 hover:text-[#0084b4] dark:text-white dark:hover:text-sky-400" [title]="item().title">
          {{ item().title }}
        </a>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
          <em>by</em>{{ ' ' }}<span class="text-slate-700 dark:text-slate-300">Technyks</span>{{ ' ' }}<em>in</em>{{ ' ' }}<button type="button" (click)="categoryClick.emit(item().category)" class="text-[#0084b4] hover:underline dark:text-sky-400">{{ item().category }}</button>
        </p>

        <div class="mt-auto flex items-end justify-between gap-3 pt-4">
          <div class="min-w-0">
            <div class="text-xl font-bold leading-none text-slate-900 dark:text-white">{{ money(item()) }}</div>
            <div class="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              @if ((item().salesCount || 0) > 0) {
                {{ item().salesCount }} {{ item().salesCount === 1 ? 'Sale' : 'Sales' }}
              } @else if (!item().fileReady) {
                Coming soon
              } @else {
                New release
              }
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <button
              type="button"
              (click)="add(item())"
              [disabled]="!item().fileReady"
              class="grid h-10 w-10 place-items-center rounded border transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              [ngClass]="cart.has(item().id) ? 'border-[#82b440] !bg-[#82b440] !text-white' : 'border-slate-300 text-slate-600 hover:border-slate-500 dark:border-white/20 dark:text-slate-300'"
              [attr.aria-label]="cart.has(item().id) ? 'In cart – go to cart' : 'Add ' + item().title + ' to cart'"
              [title]="cart.has(item().id) ? 'In cart' : 'Add to cart'"
            >
              <span class="material-symbols-outlined text-xl">{{ cart.has(item().id) ? 'shopping_cart_checkout' : 'add_shopping_cart' }}</span>
            </button>
            @if (item().previewUrl) {
              <a [href]="item().previewUrl" target="_blank" rel="noopener" class="inline-flex h-10 items-center rounded border border-[#0084b4] px-3 text-sm font-semibold text-[#0084b4] hover:!bg-[#0084b4] hover:!text-white dark:border-sky-400 dark:text-sky-400">
                Live Preview
              </a>
            } @else {
              <a [routerLink]="['/templates', item().slug]" class="inline-flex h-10 items-center rounded border border-[#0084b4] px-3 text-sm font-semibold text-[#0084b4] hover:!bg-[#0084b4] hover:!text-white dark:border-sky-400 dark:text-sky-400">
                View Details
              </a>
            }
          </div>
        </div>
      </div>
    </article>
  `,
})
export class TemplateCardComponent {
  readonly item = input.required<UiTemplate>();
  /** Fired when the category link is clicked (the store filters by it). */
  readonly categoryClick = output<string>();

  readonly cart = inject(TemplateCartService);
  private readonly router = inject(Router);
  private readonly prices = inject(LocalPriceService);

  add(item: UiTemplate) {
    if (this.cart.has(item.id)) {
      this.router.navigate(['/cart']);
      return;
    }
    this.cart.add(item);
  }

  /** Price in the visitor's currency. */
  money(item: UiTemplate) {
    return this.prices.format(item.price, item.currency);
  }
}
