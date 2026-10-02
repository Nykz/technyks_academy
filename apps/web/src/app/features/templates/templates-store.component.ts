import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TemplateCartService } from '../../core/services/template-cart.service';
import {
  TemplatesService,
  UiTemplate,
} from '../../core/services/templates.service';
import { TemplateCardComponent } from '../../core/components/template-card/template-card.component';

type SortOption = 'featured' | 'newest' | 'best-sellers' | 'price-low' | 'price-high';

/** UI template marketplace, laid out like a CodeCanyon category page. */
@Component({
  selector: 'app-templates-store',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TemplateCardComponent],
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
              <app-template-card [item]="item" (categoryClick)="category.set($event)" />
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
}
