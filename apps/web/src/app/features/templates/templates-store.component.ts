import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { TemplateCartService } from '../../core/services/template-cart.service';
import {
  TemplatesService,
  UiTemplate,
} from '../../core/services/templates.service';
import { MediaUrlPipe } from '../../core/pipes/media-url.pipe';
import { LocalPriceService } from '../../core/services/local-price.service';

type SortOption = 'featured' | 'newest' | 'best-sellers' | 'price-low' | 'price-high';

/** UI template marketplace, laid out like a CodeCanyon category page. */
@Component({
  selector: 'app-templates-store',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MediaUrlPipe],
  template: `
    <main class="min-h-screen bg-[#f2f4f5] text-slate-900 dark:bg-[#040810] dark:text-white">
      <!-- Page header -->
      <section class="border-b border-slate-200 bg-white dark:border-white/10 dark:bg-[#07101f]">
        <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 md:py-10 lg:px-8">
          <nav class="text-xs text-slate-500 dark:text-slate-400" aria-label="Breadcrumb">
            <a routerLink="/" class="hover:underline">Home</a>
            <span class="mx-1.5">›</span>
            <span class="text-slate-700 dark:text-slate-200">UI Templates</span>
          </nav>
          <div class="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 class="font-['Hanken_Grotesk'] text-3xl font-bold sm:text-4xl">UI Templates</h1>
              <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                Production-ready source code for dashboards, apps and landing pages. Buy once, download the ZIP and keep it in your account forever.
              </p>
            </div>
            <a routerLink="/cart" class="inline-flex items-center gap-2 self-start rounded border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 hover:border-slate-500 dark:border-white/20 dark:bg-transparent dark:text-slate-100 sm:self-auto">
              <span class="material-symbols-outlined text-lg">shopping_cart</span>
              Cart ({{ cart.count() }})
            </a>
          </div>

          <!-- Category chips -->
          @if (categories().length > 1) {
            <div class="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
              <button type="button" (click)="category.set('')" class="shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors" [ngClass]="category() === '' ? activeChip : inactiveChip">
                All
              </button>
              @for (item of categories(); track item) {
                <button type="button" (click)="category.set(item)" class="shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors" [ngClass]="category() === item ? activeChip : inactiveChip">
                  {{ item }}
                </button>
              }
            </div>
          }
        </div>
      </section>

      <section class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <!-- Toolbar -->
        <div class="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p class="text-sm text-slate-600 dark:text-slate-400">
            <strong class="text-slate-900 dark:text-white">{{ filtered().length }}</strong>
            {{ filtered().length === 1 ? 'item' : 'items' }}{{ category() ? ' in ' + category() : '' }}
          </p>
          <div class="flex flex-col gap-2 sm:flex-row">
            <label class="relative sm:w-72">
              <span class="sr-only">Search templates</span>
              <span class="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400">search</span>
              <input [ngModel]="query()" (ngModelChange)="query.set($event)" type="search" placeholder="Search templates" class="w-full rounded border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-[#0084b4] dark:border-white/15 dark:bg-[#121A2B] dark:text-white" />
            </label>
            <label class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <span class="whitespace-nowrap">Sort by</span>
              <select [ngModel]="sort()" (ngModelChange)="sort.set($event)" class="w-full rounded border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-white/15 dark:bg-[#121A2B] dark:text-white sm:w-auto">
                <option value="featured">Featured</option>
                <option value="best-sellers">Best sellers</option>
                <option value="newest">Newest</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
              </select>
            </label>
          </div>
        </div>

        @if (loading()) {
          <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            @for (i of [1, 2, 3]; track i) {
              <div class="animate-pulse overflow-hidden rounded border border-slate-200 bg-white dark:border-white/10 dark:bg-[#121A2B]">
                <div class="aspect-[59/30] bg-slate-200 dark:bg-white/10"></div>
                <div class="space-y-3 p-4">
                  <div class="h-4 w-3/4 rounded bg-slate-200 dark:bg-white/10"></div>
                  <div class="h-3 w-1/2 rounded bg-slate-200 dark:bg-white/10"></div>
                  <div class="h-8 w-full rounded bg-slate-200 dark:bg-white/10"></div>
                </div>
              </div>
            }
          </div>
        } @else if (error()) {
          <div role="alert" class="rounded border border-red-200 bg-red-50 p-5 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            {{ error() }}
          </div>
        } @else {
          <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            @for (item of filtered(); track item.id) {
              <article class="group flex flex-col overflow-hidden rounded border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-lg dark:border-white/10 dark:bg-[#121A2B]">
                <a [routerLink]="['/templates', item.slug]" class="relative block aspect-[59/30] overflow-hidden bg-slate-100 dark:bg-[#0B1220]" [attr.aria-label]="item.title">
                  @if (item.thumbnail) {
                    <img [src]="item.thumbnail | mediaUrl" [alt]="item.title" loading="lazy" class="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]" />
                  } @else {
                    <!-- No cover yet: a branded placeholder instead of an empty box -->
                    <span class="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center" style="background:linear-gradient(135deg,#0b1f4d,#1d4ed8);color:#ffffff">
                      <span class="material-symbols-outlined text-4xl opacity-80">web</span>
                      <span class="line-clamp-2 font-['Hanken_Grotesk'] text-lg font-bold">{{ item.title }}</span>
                      <span class="text-xs uppercase tracking-widest opacity-70">{{ item.category }}</span>
                    </span>
                  }
                  @if (item.isFeatured) {
                    <!-- Corner ribbon, like CodeCanyon's sale tag -->
                    <span class="absolute left-0 top-0 h-0 w-0 border-r-[44px] border-t-[44px] border-r-transparent" style="border-top-color:#82b440" aria-hidden="true"></span>
                    <span class="material-symbols-outlined absolute left-1 top-1 text-base" style="color:#ffffff" aria-hidden="true">star</span>
                    <span class="sr-only">Featured</span>
                  }
                </a>

                <div class="flex flex-1 flex-col p-4">
                  <a [routerLink]="['/templates', item.slug]" class="line-clamp-1 font-bold text-slate-900 hover:text-[#0084b4] dark:text-white dark:hover:text-sky-400" [title]="item.title">
                    {{ item.title }}
                  </a>
                  <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    <em>by</em>{{ ' ' }}<span class="text-slate-700 dark:text-slate-300">Technyks</span>{{ ' ' }}<em>in</em>{{ ' ' }}<button type="button" (click)="category.set(item.category)" class="text-[#0084b4] hover:underline dark:text-sky-400">{{ item.category }}</button>
                  </p>

                  <div class="mt-auto flex items-end justify-between gap-3 pt-4">
                    <div class="min-w-0">
                      <div class="text-xl font-bold leading-none text-slate-900 dark:text-white">{{ money(item) }}</div>
                      <div class="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                        @if ((item.salesCount || 0) > 0) {
                          {{ item.salesCount }} {{ item.salesCount === 1 ? 'Sale' : 'Sales' }}
                        } @else if (!item.fileReady) {
                          Coming soon
                        } @else {
                          New release
                        }
                      </div>
                    </div>
                    <div class="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        (click)="add(item)"
                        [disabled]="!item.fileReady"
                        class="grid h-10 w-10 place-items-center rounded border transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                        [ngClass]="cart.has(item.id) ? 'border-[#82b440] !bg-[#82b440] !text-white' : 'border-slate-300 text-slate-600 hover:border-slate-500 dark:border-white/20 dark:text-slate-300'"
                        [attr.aria-label]="cart.has(item.id) ? 'In cart – go to cart' : 'Add ' + item.title + ' to cart'"
                        [title]="cart.has(item.id) ? 'In cart' : 'Add to cart'"
                      >
                        <span class="material-symbols-outlined text-xl">{{ cart.has(item.id) ? 'shopping_cart_checkout' : 'add_shopping_cart' }}</span>
                      </button>
                      @if (item.previewUrl) {
                        <a [href]="item.previewUrl" target="_blank" rel="noopener" class="inline-flex h-10 items-center rounded border border-[#0084b4] px-3 text-sm font-semibold text-[#0084b4] hover:!bg-[#0084b4] hover:!text-white dark:border-sky-400 dark:text-sky-400">
                          Live Preview
                        </a>
                      } @else {
                        <a [routerLink]="['/templates', item.slug]" class="inline-flex h-10 items-center rounded border border-[#0084b4] px-3 text-sm font-semibold text-[#0084b4] hover:!bg-[#0084b4] hover:!text-white dark:border-sky-400 dark:text-sky-400">
                          View Details
                        </a>
                      }
                    </div>
                  </div>
                </div>
              </article>
            }
          </div>
          @if (!filtered().length) {
            <div class="py-20 text-center">
              <p class="text-slate-600 dark:text-slate-400">No templates match your search.</p>
              <button type="button" (click)="query.set(''); category.set('')" class="mt-3 text-sm font-bold text-[#0084b4] hover:underline">Clear filters</button>
            </div>
          }
        }
      </section>
    </main>
  `,
})
export class TemplatesStoreComponent implements OnInit {
  private templatesService = inject(TemplatesService);
  private router = inject(Router);
  private readonly prices = inject(LocalPriceService);
  cart = inject(TemplateCartService);

  readonly activeChip = 'border-slate-900 !bg-slate-900 !text-white dark:border-white dark:!bg-white dark:!text-slate-900';
  readonly inactiveChip = 'border-slate-300 bg-white text-slate-700 hover:border-slate-500 dark:border-white/20 dark:bg-transparent dark:text-slate-200';

  templates = signal<UiTemplate[]>([]);
  loading = signal(true);
  error = signal('');
  query = signal('');
  category = signal('');
  sort = signal<SortOption>('featured');

  categories = computed(() =>
    [...new Set(this.templates().map((item) => item.category))].sort(),
  );

  filtered = computed(() => {
    const query = this.query().trim().toLowerCase();
    const category = this.category();
    const list = this.templates().filter(
      (item) =>
        (!category || item.category === category) &&
        (!query ||
          [item.title, item.tagline, item.category, ...item.tags]
            .join(' ')
            .toLowerCase()
            .includes(query)),
    );
    const time = (item: UiTemplate) => new Date(item.createdAt || item.updatedAt || 0).getTime();
    switch (this.sort()) {
      case 'newest':
        return [...list].sort((a, b) => time(b) - time(a));
      case 'best-sellers':
        return [...list].sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0));
      case 'price-low':
        return [...list].sort((a, b) => a.price - b.price);
      case 'price-high':
        return [...list].sort((a, b) => b.price - a.price);
      default:
        return list; // Server order: featured first, then newest.
    }
  });

  ngOnInit() {
    this.templatesService.list().subscribe({
      next: (items) => {
        this.templates.set(items);
        this.cart.syncWithCatalog(items);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('The template shop could not be loaded. Please retry.');
        this.loading.set(false);
      },
    });
  }

  add(item: UiTemplate) {
    if (this.cart.has(item.id)) {
      this.router.navigate(['/cart']);
      return;
    }
    this.cart.add(item);
  }

  /** Price in the visitor's currency (rupees in India). */
  money(item: UiTemplate) {
    return this.prices.format(item.price, item.currency);
  }
}
