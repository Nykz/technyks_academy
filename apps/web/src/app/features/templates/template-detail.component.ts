import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TemplateCartService } from '../../core/services/template-cart.service';
import {
  TemplatesService,
  UiTemplate,
} from '../../core/services/templates.service';
import {
  CarouselSlide,
  TemplateMediaCarouselComponent,
} from './template-media-carousel.component';
import { LocalPriceService } from '../../core/services/local-price.service';

/** Template product page, laid out like a CodeCanyon item page. */
@Component({
  selector: 'app-template-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, TemplateMediaCarouselComponent],
  template: `
    <main class="min-h-screen bg-white text-slate-900 dark:bg-[#040810] dark:text-white">
      @if (loading()) {
        <p class="py-24 text-center text-slate-500" role="status">Loading template…</p>
      } @else if (error()) {
        <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div role="alert" class="rounded bg-red-50 p-5 text-red-800 dark:bg-red-950 dark:text-red-200">{{ error() }}</div>
          <a routerLink="/templates" class="mt-4 inline-block text-sm font-bold text-[#0084b4] hover:underline">← All UI templates</a>
        </div>
      } @else if (item(); as t) {
        <!-- Item header -->
        <section class="border-b border-slate-200 bg-[#f7f8f9] dark:border-white/10 dark:bg-[#07101f]">
          <div class="mx-auto max-w-7xl px-4 pb-0 pt-6 sm:px-6 lg:px-8">
            <nav class="text-xs text-slate-500 dark:text-slate-400" aria-label="Breadcrumb">
              <a routerLink="/" class="hover:underline">Home</a>
              <span class="mx-1.5">›</span>
              <a routerLink="/templates" class="hover:underline">UI Templates</a>
              <span class="mx-1.5">›</span>
              <span class="text-slate-700 dark:text-slate-200">{{ t.category }}</span>
            </nav>
            <div class="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div class="min-w-0">
                <h1 class="font-['Hanken_Grotesk'] text-2xl font-bold leading-tight sm:text-3xl">{{ t.title }}</h1>
                <p class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
                  <span>By <span class="font-semibold text-[#0084b4] dark:text-sky-400">Technyks</span></span>
                  @if ((t.salesCount || 0) > 0) {
                    <span class="inline-flex items-center gap-1">
                      <span class="material-symbols-outlined text-lg">shopping_cart</span>
                      <strong>{{ t.salesCount }}</strong> {{ t.salesCount === 1 ? 'sale' : 'sales' }}
                    </span>
                  }
                  @if (t.isFeatured) {
                    <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold" style="background:#eef6e3;color:#4d7a1a">
                      <span class="material-symbols-outlined text-sm">star</span> Featured
                    </span>
                  }
                </p>
              </div>
              <!-- Price button (phones and tablets; desktop shows the sidebar) -->
              <button type="button" (click)="buy()" [disabled]="!t.fileReady" class="inline-flex items-center justify-center gap-2 self-start rounded px-5 py-3 text-2xl font-bold shadow-sm disabled:opacity-50 lg:hidden" style="background:#82b440;color:#ffffff">
                <span class="material-symbols-outlined">shopping_cart</span>
                {{ money(t) }}
              </button>
            </div>
            <div class="mt-5 flex gap-6 text-sm font-semibold">
              <span class="-mb-px border-b-[3px] border-[#0084b4] pb-3 text-slate-900 dark:text-white">Item Details</span>
            </div>
          </div>
        </section>

        <div class="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8">
          <!-- Main column -->
          <section class="min-w-0">
            <div class="rounded border border-slate-200 p-3 dark:border-white/10 sm:p-5">
              <app-template-media-carousel [slides]="slides()" [label]="t.title" />
              <div class="mt-4 flex flex-wrap justify-center gap-3">
                @if (t.previewUrl) {
                  <a [href]="t.previewUrl" target="_blank" rel="noopener" class="inline-flex min-w-[160px] items-center justify-center gap-2 rounded px-5 py-3 font-semibold shadow-sm hover:opacity-90" style="background:#0084b4;color:#ffffff">
                    Live Preview
                    <span class="material-symbols-outlined text-xl">preview</span>
                  </a>
                }
                @if (imageSlides().length) {
                  <button type="button" (click)="openScreenshots()" class="inline-flex min-w-[160px] items-center justify-center gap-2 rounded px-5 py-3 font-semibold shadow-sm hover:opacity-90" style="background:#7a7a7a;color:#ffffff">
                    Screenshots
                    <span class="material-symbols-outlined text-xl">photo_library</span>
                  </button>
                }
              </div>
            </div>

            <article class="mt-8">
              @if (t.tagline) {
                <p class="text-lg font-semibold leading-7 text-slate-800 dark:text-slate-100">{{ t.tagline }}</p>
              }
              <div class="mt-4 whitespace-pre-line leading-7 text-slate-700 dark:text-slate-300">{{ t.description }}</div>

              <h2 class="mt-8 text-xl font-bold">What you get</h2>
              <ul class="mt-4 grid gap-3 sm:grid-cols-2">
                @for (line of includes; track line) {
                  <li class="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <span class="material-symbols-outlined text-lg" style="color:#82b440">check_circle</span>{{ line }}
                  </li>
                }
              </ul>
            </article>
          </section>

          <!-- Sidebar -->
          <aside class="flex flex-col gap-5 lg:sticky lg:top-24 lg:h-fit">
            <div class="rounded border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#121A2B]">
              <div class="flex items-baseline justify-between gap-3">
                <span class="font-semibold">Regular License</span>
                <span class="text-3xl font-bold">{{ money(t) }}</span>
              </div>
              @if (prices.chargeCurrency() !== prices.currency()) {
                <p class="mt-1 text-right text-xs text-slate-500">Charged as {{ prices.formatCharge(t.price) }}</p>
              }
              <ul class="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                @for (line of licenseLines; track line) {
                  <li class="flex items-start gap-2">
                    <span class="material-symbols-outlined text-lg" style="color:#82b440">check</span>{{ line }}
                  </li>
                }
              </ul>
              <button type="button" (click)="add()" [disabled]="!t.fileReady" class="mt-5 flex w-full items-center justify-center gap-2 rounded py-3.5 font-bold shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50" style="background:#82b440;color:#ffffff">
                <span class="material-symbols-outlined">{{ cart.has(t.id) ? 'shopping_cart_checkout' : 'add_shopping_cart' }}</span>
                {{ !t.fileReady ? 'Coming soon' : cart.has(t.id) ? 'Go to cart' : 'Add to Cart' }}
              </button>
              @if (t.fileReady && !cart.has(t.id)) {
                <button type="button" (click)="buy()" class="mt-2 w-full rounded border border-slate-300 py-3 text-sm font-bold text-slate-800 hover:border-slate-500 dark:border-white/20 dark:text-slate-100">
                  Buy Now
                </button>
              }
              <p class="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span class="material-symbols-outlined text-base">lock</span>
                Secure checkout · Instant download from your dashboard
              </p>
            </div>

            <!-- Author -->
            <div class="flex items-center gap-3 rounded border border-slate-200 p-4 dark:border-white/10">
              <span class="grid h-12 w-12 shrink-0 place-items-center rounded text-xl font-bold" style="background:#1d4ed8;color:#ffffff">T</span>
              <div>
                <p class="font-bold">Technyks</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">Author · Technyks Academy</p>
              </div>
            </div>

            <!-- Item details table -->
            <div class="rounded border border-slate-200 dark:border-white/10">
              <dl class="divide-y divide-slate-200 text-sm dark:divide-white/10">
                @if (t.updatedAt) {
                  <div class="grid grid-cols-[120px_1fr] gap-3 px-4 py-3">
                    <dt class="text-slate-500 dark:text-slate-400">Last Update</dt>
                    <dd>{{ t.updatedAt | date: 'd MMMM y' }}</dd>
                  </div>
                }
                @if (t.createdAt) {
                  <div class="grid grid-cols-[120px_1fr] gap-3 px-4 py-3">
                    <dt class="text-slate-500 dark:text-slate-400">Published</dt>
                    <dd>{{ t.createdAt | date: 'd MMMM y' }}</dd>
                  </div>
                }
                <div class="grid grid-cols-[120px_1fr] gap-3 px-4 py-3">
                  <dt class="text-slate-500 dark:text-slate-400">Category</dt>
                  <dd>{{ t.category }}</dd>
                </div>
                <div class="grid grid-cols-[120px_1fr] gap-3 px-4 py-3">
                  <dt class="text-slate-500 dark:text-slate-400">Files Included</dt>
                  <dd>{{ t.deliveryType === 'external' ? 'Download link' : 'Source code ZIP' }}{{ t.fileSize ? ' (' + fileSize(t.fileSize) + ')' : '' }}</dd>
                </div>
                <div class="grid grid-cols-[120px_1fr] gap-3 px-4 py-3">
                  <dt class="text-slate-500 dark:text-slate-400">Layout</dt>
                  <dd>Responsive</dd>
                </div>
                @if (t.tags.length) {
                  <div class="grid grid-cols-[120px_1fr] gap-3 px-4 py-3">
                    <dt class="text-slate-500 dark:text-slate-400">Tags</dt>
                    <dd class="flex flex-wrap gap-1.5">
                      @for (tag of t.tags; track tag) {
                        <span class="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-white/10 dark:text-slate-300">{{ tag }}</span>
                      }
                    </dd>
                  </div>
                }
              </dl>
            </div>
          </aside>
        </div>

        <!-- Screenshots viewer -->
        @if (screenshotsOpen()) {
          <div class="fixed inset-0 z-[100] flex flex-col overflow-y-auto p-3 sm:p-6" style="background:rgba(3,7,18,0.97)" role="dialog" aria-modal="true" [attr.aria-label]="t.title + ' screenshots'">
            <div class="mb-3 flex items-center justify-between gap-3">
              <p class="truncate text-sm font-semibold" style="color:#ffffff">{{ t.title }} · Screenshots</p>
              <button type="button" (click)="closeScreenshots()" class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15 hover:bg-white/25" style="color:#ffffff" aria-label="Close screenshots">
                <span class="material-symbols-outlined">close</span>
              </button>
            </div>
            <div class="mx-auto flex w-full max-w-6xl flex-1 items-center">
              <app-template-media-carousel [slides]="imageSlides()" [label]="t.title + ' screenshots'" />
            </div>
          </div>
        }
      }
    </main>
  `,
})
export class TemplateDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(TemplatesService);
  private sanitizer = inject(DomSanitizer);
  private title = inject(Title);
  readonly prices = inject(LocalPriceService);
  cart = inject(TemplateCartService);

  readonly includes = [
    'Organized source files',
    'Responsive layouts',
    'Commercial project license',
    'Permanent download from your dashboard',
  ];
  readonly licenseLines = [
    'Use in commercial projects',
    'Instant download after payment',
    'Lifetime access in your account',
  ];

  item = signal<UiTemplate | null>(null);
  loading = signal(true);
  error = signal('');
  promoEmbedUrl = signal<SafeResourceUrl | null>(null);
  screenshotsOpen = signal(false);

  /** Promo video (or thumbnail) first, then every screenshot. */
  readonly slides = computed<CarouselSlide[]>(() => {
    const item = this.item();
    if (!item) return [];
    const slides: CarouselSlide[] = [];
    const embed = this.promoEmbedUrl();
    if (this.isDirectVideo(item.promoVideoUrl)) {
      slides.push({ kind: 'video', src: item.promoVideoUrl as string, poster: item.thumbnail });
    } else if (embed) {
      slides.push({ kind: 'embed', src: embed, title: `${item.title} promotional video` });
    }
    return [...slides, ...this.imageSlides()];
  });

  readonly imageSlides = computed<CarouselSlide[]>(() => {
    const item = this.item();
    if (!item) return [];
    const images: CarouselSlide[] = [];
    if (item.thumbnail) images.push({ kind: 'image', src: item.thumbnail, alt: item.title });
    (item.gallery || []).forEach((src, index) =>
      images.push({ kind: 'image', src, alt: `${item.title} screen ${index + 1}` }),
    );
    return images;
  });

  ngOnInit() {
    this.service.get(this.route.snapshot.paramMap.get('slug') || '').subscribe({
      next: (item) => {
        this.item.set(item);
        this.title.setTitle(`${item.title} | Technyks UI Templates`);
        this.promoEmbedUrl.set(this.toPromoEmbedUrl(item.promoVideoUrl || ''));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('This UI template is unavailable.');
        this.loading.set(false);
      },
    });
  }

  add() {
    const item = this.item();
    if (!item) return;
    if (this.cart.has(item.id)) {
      this.router.navigate(['/cart']);
      return;
    }
    this.cart.add(item);
  }

  buy() {
    const item = this.item();
    if (!item || !item.fileReady) return;
    this.cart.add(item);
    this.router.navigate(['/cart']);
  }

  openScreenshots() {
    this.screenshotsOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  @HostListener('document:keydown.escape')
  closeScreenshots() {
    if (!this.screenshotsOpen()) return;
    this.screenshotsOpen.set(false);
    document.body.style.overflow = '';
  }

  /** Price in the visitor's currency (rupees in India). */
  money(item: UiTemplate) {
    return this.prices.format(item.price, item.currency);
  }

  fileSize(bytes: number) {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  isDirectVideo(value: unknown) {
    const url = String(value || '')
      .toLowerCase()
      .split('?')[0];
    return (
      url.includes('/uploads/course-media/video-') ||
      /\.(?:mp4|webm|ogv|mov)$/.test(url)
    );
  }

  private toPromoEmbedUrl(value: string): SafeResourceUrl | null {
    const clean = String(value || '').trim();
    if (!clean || this.isDirectVideo(clean)) return null;
    let embed = '';
    try {
      const url = new URL(clean);
      if (url.hostname.includes('youtu.be'))
        embed = `https://www.youtube-nocookie.com/embed/${url.pathname.slice(1)}`;
      else if (url.hostname.includes('youtube.com')) {
        const id =
          url.searchParams.get('v') ||
          url.pathname.split('/').filter(Boolean).pop();
        if (id) embed = `https://www.youtube-nocookie.com/embed/${id}`;
      } else if (url.hostname.includes('vimeo.com')) {
        const id = url.pathname.split('/').filter(Boolean).pop();
        if (id) embed = `https://player.vimeo.com/video/${id}`;
      }
    } catch {
      return null;
    }
    return embed ? this.sanitizer.bypassSecurityTrustResourceUrl(embed) : null;
  }
}
