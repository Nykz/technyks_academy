import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TemplateCartService } from '../../core/services/template-cart.service';
import { TemplatesService } from '../../core/services/templates.service';
import { MediaUrlPipe } from '../../core/pipes/media-url.pipe';

@Component({
  selector: 'app-template-cart',
  standalone: true,
  imports: [CommonModule, RouterModule, MediaUrlPipe],
  template: `
    <main
      class="min-h-screen bg-slate-50 px-5 py-12 text-slate-950 dark:bg-[#040810] dark:text-white md:px-12"
    >
      <div class="mx-auto max-w-5xl">
        <div
          class="flex items-end justify-between border-b border-slate-200 pb-7 dark:border-white/10"
        >
          <div>
            <div
              class="font-['JetBrains_Mono'] text-xs font-bold uppercase tracking-widest text-blue-600"
            >
              Your basket
            </div>
            <h1 class="mt-2 text-4xl font-extrabold">UI Template Cart</h1>
          </div>
          <a
            routerLink="/templates"
            class="text-sm font-semibold text-blue-700 dark:text-blue-400"
            >Continue shopping</a
          >
        </div>
        @if (!cart.items().length) {
          <div
            class="mt-10 rounded-2xl border border-slate-200 bg-white p-14 text-center dark:border-white/10 dark:bg-[#121A2B]"
          >
            <span class="material-symbols-outlined text-5xl text-slate-400"
              >shopping_bag</span
            >
            <h2 class="mt-4 text-2xl font-bold">Your cart is empty</h2>
            <p class="mt-2 text-slate-500">
              Pick a template and it will appear here.
            </p>
            <a
              routerLink="/templates"
              class="mt-6 inline-block rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold !text-white"
              >Browse UI templates</a
            >
          </div>
        } @else {
          <div class="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
            <section class="space-y-4">
              @for (item of cart.items(); track item.id) {
                <article
                  class="flex gap-5 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#121A2B]"
                >
                  <a
                    [routerLink]="['/templates', item.slug]"
                    class="h-24 w-36 shrink-0 overflow-hidden rounded-xl bg-blue-700"
                  >
                    @if (item.thumbnail) {
                      <img
                        [src]="item.thumbnail | mediaUrl"
                        [alt]="item.title"
                        class="h-full w-full object-cover"
                      />
                    }
                  </a>
                  <div class="min-w-0 flex-1">
                    <a
                      [routerLink]="['/templates', item.slug]"
                      class="text-lg font-bold"
                      >{{ item.title }}</a
                    >
                    <p class="mt-1 text-sm text-slate-500">
                      {{ item.category }}
                    </p>
                    <button
                      (click)="cart.remove(item.id)"
                      class="mt-4 text-xs font-bold text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                  <div class="font-bold">
                    {{ money(item.price, item.currency) }}
                  </div>
                </article>
              }
            </section>
            <aside
              class="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-[#121A2B] lg:sticky lg:top-6"
            >
              <h2 class="text-xl font-bold">Order summary</h2>
              <div
                class="mt-5 flex justify-between border-b border-slate-200 pb-5 dark:border-white/10"
              >
                <span class="text-slate-500">{{ cart.count() }} item(s)</span
                ><span class="font-bold">{{
                  money(cart.subtotal(), 'INR')
                }}</span>
              </div>
              <div class="mt-5 flex justify-between text-xl font-extrabold">
                <span>Total</span
                ><span>{{ money(cart.subtotal(), 'INR') }}</span>
              </div>
              <a
                routerLink="/checkout"
                [queryParams]="{ templateCart: 1 }"
                class="mt-6 block rounded-xl bg-blue-600 py-4 text-center font-['JetBrains_Mono'] text-xs font-bold uppercase !text-white"
                >Secure checkout</a
              >
              <p class="mt-4 text-center text-xs text-slate-500">
                Your files stay available in your account after purchase.
              </p>
            </aside>
          </div>
        }
      </div>
    </main>
  `,
})
export class TemplateCartComponent implements OnInit {
  cart = inject(TemplateCartService);
  private templatesService = inject(TemplatesService);
  ngOnInit() {
    this.templatesService
      .list()
      .subscribe({ next: (items) => this.cart.syncWithCatalog(items) });
  }
  money(price: number, currency: string) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(price);
  }
}
