import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  AdminUiTemplate,
  TemplatesService,
} from '../../core/services/templates.service';
import { MediaUrlPipe } from '../../core/pipes/media-url.pipe';

@Component({
  selector: 'app-admin-templates',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MediaUrlPipe],
  template: `
    <section class="space-y-6">
      <header
        class="rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-[#121A2B]"
      >
        <div
          class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"
        >
          <div>
            <p
              class="font-['JetBrains_Mono'] text-[10px] font-bold uppercase tracking-[.22em] text-blue-600"
            >
              Digital product commerce
            </p>
            <h2 class="mt-2 text-3xl font-bold text-slate-950 dark:text-white">
              UI Template Products
            </h2>
            <p
              class="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300"
            >
              Review your products here, then open a dedicated editor for
              product information, media, delivery and publishing.
            </p>
          </div>
          <a
            routerLink="/admin/templates/new/manage"
            class="inline-flex w-fit items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-['JetBrains_Mono'] text-xs font-bold uppercase !text-white shadow-lg transition hover:bg-blue-700"
          >
            <span class="material-symbols-outlined text-lg">add</span>
            New product
          </a>
        </div>
      </header>

      <div class="grid gap-4 sm:grid-cols-3">
        <article class="summary-card">
          <span class="material-symbols-outlined">inventory_2</span>
          <div>
            <strong>{{ products().length }}</strong
            ><small>Total products</small>
          </div>
        </article>
        <article class="summary-card">
          <span class="material-symbols-outlined">public</span>
          <div>
            <strong>{{ publishedCount() }}</strong
            ><small>Published</small>
          </div>
        </article>
        <article class="summary-card">
          <span class="material-symbols-outlined">cloud_done</span>
          <div>
            <strong>{{ readyCount() }}</strong
            ><small>Ready to sell</small>
          </div>
        </article>
      </div>

      <div
        class="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#121A2B] md:flex-row"
      >
        <label class="relative flex-1">
          <span
            class="material-symbols-outlined absolute left-3 top-2.5 text-slate-400"
            >search</span
          >
          <input
            [(ngModel)]="query"
            type="search"
            placeholder="Search products, categories or tags"
            class="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-950 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-[#080D18] dark:text-white"
          />
        </label>
        <select
          [(ngModel)]="status"
          class="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-950 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-[#080D18] dark:text-white"
        >
          <option value="all">All products</option>
          <option value="published">Published</option>
          <option value="draft">Drafts</option>
          <option value="ready">Delivery ready</option>
          <option value="missing">Delivery required</option>
        </select>
        <button
          type="button"
          (click)="reload()"
          class="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-blue-500 hover:text-blue-700 dark:border-slate-700 dark:text-slate-200"
        >
          <span
            class="material-symbols-outlined text-lg"
            [class.animate-spin]="loading()"
            >refresh</span
          >
          Refresh
        </button>
      </div>

      @if (loading()) {
        <div
          class="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
          aria-label="Loading products"
        >
          @for (row of [1, 2, 3, 4, 5, 6]; track row) {
            <div
              class="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#121A2B]"
            ></div>
          }
        </div>
      } @else if (error()) {
        <div
          role="alert"
          class="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"
        >
          {{ error() }}
        </div>
      } @else if (filteredProducts().length) {
        <div class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          @for (item of filteredProducts(); track item.id) {
            <article
              class="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-xl dark:border-white/10 dark:bg-[#121A2B] dark:hover:border-blue-700"
            >
              <a
                [routerLink]="['/admin/templates', item.id, 'manage']"
                class="relative block aspect-video overflow-hidden bg-slate-100 dark:bg-[#080D18]"
              >
                @if (item.thumbnail) {
                  <img
                    [src]="item.thumbnail | mediaUrl"
                    [alt]="item.title"
                    class="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                } @else {
                  <span
                    class="material-symbols-outlined grid h-full place-items-center text-5xl text-slate-400"
                    >image</span
                  >
                }
                <div class="absolute left-3 top-3 flex flex-wrap gap-2">
                  <span
                    class="rounded-full px-2.5 py-1 text-[9px] font-bold uppercase shadow"
                    [class.bg-emerald-100]="item.isPublished"
                    [class.text-emerald-800]="item.isPublished"
                    [class.bg-slate-200]="!item.isPublished"
                    [class.text-slate-700]="!item.isPublished"
                    >{{ item.isPublished ? 'Published' : 'Draft' }}</span
                  >
                  @if (item.promoVideoUrl) {
                    <span
                      class="rounded-full bg-blue-600 px-2.5 py-1 text-[9px] font-bold uppercase text-white shadow"
                      >Video</span
                    >
                  }
                </div>
              </a>
              <div class="p-5">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p
                      class="font-['JetBrains_Mono'] text-[10px] font-bold uppercase tracking-wider text-blue-600"
                    >
                      {{ item.category }}
                    </p>
                    <h3
                      class="mt-1 line-clamp-2 text-lg font-bold text-slate-950 dark:text-white"
                    >
                      {{ item.title }}
                    </h3>
                  </div>
                  <strong
                    class="shrink-0 text-lg text-slate-950 dark:text-white"
                    >{{ money(item.price, item.currency) }}</strong
                  >
                </div>
                <p
                  class="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-slate-600 dark:text-slate-300"
                >
                  {{ item.tagline }}
                </p>
                <div
                  class="mt-4 flex items-center gap-2 text-xs font-semibold"
                  [class.text-emerald-700]="item.fileReady"
                  [class.text-amber-700]="!item.fileReady"
                  [class.dark:text-emerald-300]="item.fileReady"
                  [class.dark:text-amber-300]="!item.fileReady"
                >
                  <span class="material-symbols-outlined text-base">{{
                    item.fileReady ? 'check_circle' : 'warning'
                  }}</span>
                  {{
                    item.fileReady
                      ? 'Delivery ready'
                      : 'Delivery file or link required'
                  }}
                </div>
                <div
                  class="mt-5 grid grid-cols-2 gap-2 border-t border-slate-200 pt-4 dark:border-white/10"
                >
                  <a
                    [routerLink]="['/admin/templates', item.id, 'manage']"
                    class="rounded-lg bg-blue-600 px-3 py-2.5 text-center font-['JetBrains_Mono'] text-[11px] font-bold uppercase !text-white hover:bg-blue-700"
                    >Edit product</a
                  >
                  <a
                    [routerLink]="['/templates', item.slug]"
                    target="_blank"
                    class="rounded-lg border border-slate-300 px-3 py-2.5 text-center font-['JetBrains_Mono'] text-[11px] font-bold uppercase text-slate-700 hover:border-blue-500 hover:text-blue-700 dark:border-slate-700 dark:text-slate-200"
                    >View store</a
                  >
                </div>
              </div>
            </article>
          }
        </div>
      } @else {
        <div
          class="rounded-2xl border border-dashed border-slate-300 bg-white p-14 text-center dark:border-slate-700 dark:bg-[#121A2B]"
        >
          <span class="material-symbols-outlined text-5xl text-slate-400"
            >search_off</span
          >
          <h3 class="mt-3 text-xl font-bold text-slate-950 dark:text-white">
            No matching products
          </h3>
          <p class="mt-1 text-sm text-slate-500">
            Change the search or filter to see more products.
          </p>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .summary-card {
        display: flex;
        align-items: center;
        gap: 1rem;
        border: 1px solid #e2e8f0;
        border-radius: 1rem;
        background: #fff;
        padding: 1.1rem 1.25rem;
      }
      .summary-card > .material-symbols-outlined {
        border-radius: 0.75rem;
        background: #dbeafe;
        padding: 0.65rem;
        color: #1d4ed8;
      }
      .summary-card strong,
      .summary-card small {
        display: block;
      }
      .summary-card strong {
        color: #0f172a;
        font-size: 1.4rem;
        line-height: 1.2;
      }
      .summary-card small {
        margin-top: 0.15rem;
        color: #64748b;
        font-size: 0.75rem;
      }
      :host-context(.dark-theme) .summary-card {
        border-color: rgba(255, 255, 255, 0.1);
        background: #121a2b;
      }
      :host-context(.dark-theme) .summary-card > .material-symbols-outlined {
        background: rgba(37, 99, 235, 0.22);
        color: #60a5fa;
      }
      :host-context(.dark-theme) .summary-card strong {
        color: #fff;
      }
    `,
  ],
})
export class AdminTemplatesComponent implements OnInit {
  private readonly service = inject(TemplatesService);

  readonly products = signal<AdminUiTemplate[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  query = '';
  status = 'all';

  ngOnInit() {
    this.reload();
  }

  reload() {
    this.loading.set(true);
    this.error.set('');
    this.service.listAdmin().subscribe({
      next: (items) => {
        this.products.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(
          'Products could not be loaded. Please refresh to retry.',
        );
      },
    });
  }

  filteredProducts() {
    const query = this.query.trim().toLowerCase();
    return this.products().filter((item) => {
      const matchesQuery =
        !query ||
        [item.title, item.tagline, item.category, ...item.tags]
          .join(' ')
          .toLowerCase()
          .includes(query);
      const matchesStatus =
        this.status === 'all' ||
        (this.status === 'published' && item.isPublished) ||
        (this.status === 'draft' && !item.isPublished) ||
        (this.status === 'ready' && item.fileReady) ||
        (this.status === 'missing' && !item.fileReady);
      return matchesQuery && matchesStatus;
    });
  }

  publishedCount() {
    return this.products().filter((item) => item.isPublished).length;
  }

  readyCount() {
    return this.products().filter((item) => item.fileReady).length;
  }

  money(price: number, currency: string) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(price);
  }
}
