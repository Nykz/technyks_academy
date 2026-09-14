import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  TemplateOrder,
  TemplatesService,
} from '../../core/services/templates.service';

@Component({
  selector: 'app-admin-template-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="space-y-6">
      <header class="rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-[#121A2B]">
        <p class="font-['JetBrains_Mono'] text-[10px] font-bold uppercase tracking-[.22em] text-blue-600">Digital product commerce</p>
        <div class="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 class="text-3xl font-bold text-slate-950 dark:text-white">Template Orders</h2>
            <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">Completed UI-template purchases only. Course payments remain in Course Sales.</p>
          </div>
          <button type="button" (click)="reload()" [disabled]="loading()" class="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 font-['JetBrains_Mono'] text-xs font-bold text-slate-700 hover:border-blue-500 hover:text-blue-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200">
            <span class="material-symbols-outlined text-base" [class.animate-spin]="loading()">refresh</span>
            Refresh orders
          </button>
        </div>
      </header>

      <div class="grid gap-4 sm:grid-cols-3">
        <article class="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#121A2B]">
          <p class="metric-label">Completed orders</p>
          <strong class="mt-2 block text-3xl text-slate-950 dark:text-white">{{ orders().length }}</strong>
        </article>
        <article class="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#121A2B]">
          <p class="metric-label">Template revenue</p>
          <strong class="mt-2 block text-3xl text-blue-700 dark:text-blue-400">{{ money(totalRevenue(), primaryCurrency()) }}</strong>
        </article>
        <article class="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#121A2B]">
          <p class="metric-label">Unique customers</p>
          <strong class="mt-2 block text-3xl text-slate-950 dark:text-white">{{ uniqueCustomers() }}</strong>
        </article>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#121A2B]">
        <div class="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-[minmax(0,1fr)_240px] dark:border-white/10">
          <label class="relative">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400">search</span>
            <input [ngModel]="query()" (ngModelChange)="query.set($event)" type="search" placeholder="Search order, customer or product…" class="admin-order-field pl-10" />
          </label>
          <select [ngModel]="productFilter()" (ngModelChange)="productFilter.set($event)" class="admin-order-field">
            <option value="">All template products</option>
            @for (product of products(); track product) {
              <option [value]="product">{{ product }}</option>
            }
          </select>
        </div>

        @if (error()) {
          <p role="alert" class="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{{ error() }}</p>
        } @else if (loading()) {
          <div class="p-12 text-center text-sm text-slate-500">Loading template orders…</div>
        } @else if (!filteredOrders().length) {
          <div class="p-12 text-center">
            <span class="material-symbols-outlined text-4xl text-slate-400">receipt_long</span>
            <h3 class="mt-3 text-lg font-bold text-slate-950 dark:text-white">No matching template orders</h3>
            <p class="mt-1 text-sm text-slate-500">Completed UI-template purchases will appear here automatically.</p>
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full min-w-[860px] text-left text-sm">
              <thead class="bg-slate-50 font-['JetBrains_Mono'] text-[10px] uppercase tracking-wider text-slate-500 dark:bg-[#080D18] dark:text-slate-400">
                <tr>
                  <th class="px-5 py-4">Order</th>
                  <th class="px-5 py-4">Product</th>
                  <th class="px-5 py-4">Customer</th>
                  <th class="px-5 py-4">Date</th>
                  <th class="px-5 py-4">Amount</th>
                  <th class="px-5 py-4">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200 dark:divide-white/10">
                @for (order of filteredOrders(); track order.id) {
                  <tr class="hover:bg-slate-50/80 dark:hover:bg-white/[.025]">
                    <td class="px-5 py-4 font-['JetBrains_Mono'] text-xs font-semibold text-slate-700 dark:text-slate-200">#{{ shortId(order.id) }}</td>
                    <td class="px-5 py-4"><strong class="text-slate-950 dark:text-white">{{ order.product.title }}</strong><span class="mt-1 block font-['JetBrains_Mono'] text-[10px] text-slate-500">/{{ order.product.slug }}</span></td>
                    <td class="px-5 py-4"><span class="font-semibold text-slate-900 dark:text-white">{{ order.buyer.name }}</span><a class="mt-1 block text-xs text-blue-700 hover:underline dark:text-blue-400" [href]="'mailto:' + order.buyer.email">{{ order.buyer.email }}</a></td>
                    <td class="px-5 py-4 text-slate-600 dark:text-slate-300">{{ order.purchasedAt | date:'medium' }}</td>
                    <td class="px-5 py-4 font-semibold text-slate-950 dark:text-white">{{ money(order.amount, order.currency) }}</td>
                    <td class="px-5 py-4"><span class="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Completed</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </section>
  `,
  styles: [`
    .metric-label { font: 700 .65rem 'JetBrains Mono'; text-transform: uppercase; letter-spacing: .12em; color: #64748b }
    .admin-order-field { width: 100%; border: 1px solid #cbd5e1; border-radius: .7rem; background: #fff; padding: .72rem .85rem; color: #0f172a; outline: none }
    .admin-order-field:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,.12) }
    :host-context(.dark-theme) .admin-order-field { border-color: #334155; background: #040810; color: #fff }
  `],
})
export class AdminTemplateOrdersComponent implements OnInit {
  private readonly templatesService = inject(TemplatesService);
  readonly orders = signal<TemplateOrder[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly query = signal('');
  readonly productFilter = signal('');

  readonly products = computed(() =>
    [...new Set(this.orders().map((order) => order.product.title))].sort(),
  );
  readonly filteredOrders = computed(() => {
    const query = this.query().trim().toLowerCase();
    return this.orders().filter((order) => {
      const selectedProduct = this.productFilter();
      const matchesProduct =
        !selectedProduct || order.product.title === selectedProduct;
      const haystack = [
        order.id,
        order.product.title,
        order.buyer.name,
        order.buyer.email,
      ]
        .join(' ')
        .toLowerCase();
      return matchesProduct && (!query || haystack.includes(query));
    });
  });
  readonly totalRevenue = computed(() =>
    this.orders().reduce((total, order) => total + Number(order.amount || 0), 0),
  );
  readonly uniqueCustomers = computed(
    () => new Set(this.orders().map((order) => order.buyer.id)).size,
  );
  readonly primaryCurrency = computed(
    () => this.orders()[0]?.currency || 'INR',
  );

  ngOnInit() {
    this.reload();
  }

  reload() {
    this.loading.set(true);
    this.error.set('');
    this.templatesService.listOrders().subscribe({
      next: (orders) => {
        this.orders.set(orders);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.error.set(
          error?.error?.message || 'Template orders could not be loaded.',
        );
      },
    });
  }

  money(amount: number, currency: string) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  shortId(id: string) {
    return String(id).replace(/-/g, '').slice(0, 10).toUpperCase();
  }
}
