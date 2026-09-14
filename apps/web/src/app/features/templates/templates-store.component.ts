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

@Component({
  selector: 'app-templates-store',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MediaUrlPipe],
  template: `
    <main
      class="min-h-screen bg-slate-50 text-slate-950 dark:bg-[#040810] dark:text-white"
    >
      <section
        class="border-b border-slate-200 bg-white px-5 py-16 dark:border-white/10 dark:bg-[#07101f] md:px-12 lg:px-20"
      >
        <div class="mx-auto max-w-7xl">
          <div
            class="mb-5 inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 font-['JetBrains_Mono'] text-[11px] font-bold uppercase tracking-[.18em] text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
          >
            Digital design shop
          </div>
          <div class="grid items-end gap-8 lg:grid-cols-[1fr_auto]">
            <div>
              <h1
                class="max-w-4xl font-['Hanken_Grotesk'] text-4xl font-extrabold leading-tight md:text-6xl"
              >
                Ship a sharper product without starting from zero.
              </h1>
              <p
                class="mt-5 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300"
              >
                Premium, production-ready UI templates for developers. Buy once,
                download the source ZIP, and keep it in your account
                permanently.
              </p>
            </div>
            <a
              routerLink="/cart"
              class="inline-flex justify-self-start items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 font-['JetBrains_Mono'] text-xs font-bold uppercase !text-white dark:bg-white dark:!text-slate-950"
            >
              <span class="material-symbols-outlined text-lg"
                >shopping_bag</span
              >
              Cart ({{ cart.count() }})
            </a>
          </div>
        </div>
      </section>

      <section class="mx-auto max-w-7xl px-5 py-10 md:px-12 lg:px-20">
        <div class="mb-8 flex flex-col gap-4 md:flex-row">
          <label class="relative flex-1">
            <span
              class="material-symbols-outlined absolute left-4 top-3.5 text-slate-400"
              >search</span
            >
            <input
              [(ngModel)]="query"
              placeholder="Search dashboards, portfolios, landing pages…"
              class="w-full rounded-xl border border-slate-300 bg-white py-3 pl-12 pr-4 text-slate-950 outline-none focus:border-blue-600 dark:border-white/15 dark:bg-[#121A2B] dark:text-white"
            />
          </label>
          <select
            [(ngModel)]="category"
            class="rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 dark:border-white/15 dark:bg-[#121A2B] dark:text-white"
          >
            <option value="">All categories</option>
            @for (item of categories(); track item) {
              <option [value]="item">{{ item }}</option>
            }
          </select>
        </div>

        @if (loading()) {
          <p role="status" class="py-20 text-center text-slate-500">
            Loading UI templates…
          </p>
        } @else if (error()) {
          <div
            role="alert"
            class="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
          >
            {{ error() }}
          </div>
        } @else {
          <div class="grid gap-7 md:grid-cols-2 xl:grid-cols-3">
            @for (item of filtered(); track item.id) {
              <article
                class="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-[#121A2B]"
              >
                <a
                  [routerLink]="['/templates', item.slug]"
                  class="relative block aspect-[16/10] overflow-hidden bg-gradient-to-br from-blue-700 to-violet-600"
                >
                  @if (item.thumbnail) {
                    <img
                      [src]="item.thumbnail | mediaUrl"
                      [alt]="item.title"
                      class="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  }
                  <div
                    class="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"
                  ></div>
                  <div class="absolute left-4 top-4 flex gap-2">
                    @if (item.isFeatured) {
                      <span
                        class="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase text-slate-950"
                        >Featured</span
                      >
                    }
                    <span
                      class="rounded-full bg-black/65 px-3 py-1 text-[10px] font-bold uppercase text-white backdrop-blur"
                      >{{ item.category }}</span
                    >
                  </div>
                </a>
                <div class="p-6">
                  <a [routerLink]="['/templates', item.slug]"
                    ><h2 class="font-['Hanken_Grotesk'] text-2xl font-bold">
                      {{ item.title }}
                    </h2></a
                  >
                  <p
                    class="mt-2 min-h-12 text-sm leading-6 text-slate-600 dark:text-slate-300"
                  >
                    {{ item.tagline }}
                  </p>
                  <div class="mt-4 flex flex-wrap gap-2">
                    @for (tag of item.tags.slice(0, 3); track tag) {
                      <span
                        class="rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300"
                        >{{ tag }}</span
                      >
                    }
                  </div>
                  <div
                    class="mt-6 flex items-center justify-between border-t border-slate-200 pt-5 dark:border-white/10"
                  >
                    <div>
                      <div class="text-2xl font-extrabold">
                        {{ money(item) }}
                      </div>
                      <div class="text-[11px] text-slate-500">
                        One-time purchase
                      </div>
                    </div>
                    <button
                      (click)="add(item)"
                      [disabled]="!item.fileReady"
                      class="rounded-lg bg-blue-600 px-4 py-3 font-['JetBrains_Mono'] text-[11px] font-bold uppercase !text-white disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
                    >
                      {{
                        !item.fileReady
                          ? 'Coming soon'
                          : cart.has(item.id)
                            ? 'In cart'
                            : 'Add to cart'
                      }}
                    </button>
                  </div>
                </div>
              </article>
            }
          </div>
          @if (!filtered().length) {
            <p class="py-20 text-center text-slate-500">
              No templates match this search.
            </p>
          }
        }
      </section>
    </main>
  `,
})
export class TemplatesStoreComponent implements OnInit {
  private templatesService = inject(TemplatesService);
  private router = inject(Router);
  cart = inject(TemplateCartService);
  templates = signal<UiTemplate[]>([]);
  loading = signal(true);
  error = signal('');
  query = '';
  category = '';
  categories = computed(() =>
    [...new Set(this.templates().map((item) => item.category))].sort(),
  );
  filtered = computed(() => {
    const query = this.query.trim().toLowerCase();
    return this.templates().filter(
      (item) =>
        (!this.category || item.category === this.category) &&
        (!query ||
          [item.title, item.tagline, item.category, ...item.tags]
            .join(' ')
            .toLowerCase()
            .includes(query)),
    );
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

  money(item: UiTemplate) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: item.currency,
      maximumFractionDigits: 0,
    }).format(item.price);
  }
}
