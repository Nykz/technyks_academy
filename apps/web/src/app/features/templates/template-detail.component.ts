import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TemplateCartService } from '../../core/services/template-cart.service';
import {
  TemplatesService,
  UiTemplate,
} from '../../core/services/templates.service';
import { MediaUrlPipe } from '../../core/pipes/media-url.pipe';

@Component({
  selector: 'app-template-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, MediaUrlPipe],
  template: `
    <main
      class="min-h-screen bg-slate-50 px-5 py-12 text-slate-950 dark:bg-[#040810] dark:text-white md:px-12 lg:px-20"
    >
      <div class="mx-auto max-w-7xl">
        <a
          routerLink="/templates"
          class="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 dark:text-blue-400"
          ><span class="material-symbols-outlined text-base">arrow_back</span>
          All UI templates</a
        >
        @if (loading()) {
          <p class="py-24 text-center">Loading template…</p>
        } @else if (error()) {
          <div
            role="alert"
            class="mt-8 rounded-xl bg-red-50 p-5 text-red-800 dark:bg-red-950 dark:text-red-200"
          >
            {{ error() }}
          </div>
        } @else if (item()) {
          <div class="mt-8 grid gap-10 lg:grid-cols-[1.4fr_.8fr]">
            <section>
              <div
                class="aspect-video overflow-hidden rounded-2xl bg-black shadow-2xl"
              >
                @if (isDirectVideo(item()!.promoVideoUrl)) {
                  <video
                    [src]="item()!.promoVideoUrl | mediaUrl"
                    controls
                    [poster]="(item()!.thumbnail | mediaUrl) || undefined"
                    class="h-full w-full object-contain"
                  ></video>
                } @else if (promoEmbedUrl()) {
                  <iframe
                    [src]="promoEmbedUrl()"
                    [title]="item()!.title + ' promotional video'"
                    class="h-full w-full border-0"
                    allow="autoplay; encrypted-media; picture-in-picture"
                    referrerpolicy="strict-origin-when-cross-origin"
                    allowfullscreen
                  ></iframe>
                } @else if (item()!.thumbnail) {
                  <img
                    [src]="item()!.thumbnail | mediaUrl"
                    [alt]="item()!.title"
                    class="h-full w-full object-cover"
                  />
                }
              </div>
              <div
                class="mt-10 rounded-2xl border border-slate-200 bg-white p-7 dark:border-white/10 dark:bg-[#121A2B]"
              >
                <h2 class="text-2xl font-bold">What you get</h2>
                <p
                  class="mt-4 whitespace-pre-line leading-7 text-slate-600 dark:text-slate-300"
                >
                  {{ item()!.description }}
                </p>
                <div class="mt-6 grid gap-3 sm:grid-cols-2">
                  @for (
                    line of [
                      'Organized source files',
                      'Commercial project license',
                      'Responsive layouts',
                      'Permanent account download',
                    ];
                    track line
                  ) {
                    <div class="flex items-center gap-2 text-sm">
                      <span
                        class="material-symbols-outlined text-lg text-emerald-600"
                        >check_circle</span
                      >{{ line }}
                    </div>
                  }
                </div>
              </div>
            </section>
            <aside
              class="h-fit rounded-2xl border border-slate-200 bg-white p-7 shadow-xl dark:border-white/10 dark:bg-[#121A2B] lg:sticky lg:top-6"
            >
              <div
                class="font-['JetBrains_Mono'] text-xs font-bold uppercase tracking-wider text-blue-600"
              >
                {{ item()!.category }}
              </div>
              <h1 class="mt-3 text-4xl font-extrabold">{{ item()!.title }}</h1>
              <p class="mt-4 leading-7 text-slate-600 dark:text-slate-300">
                {{ item()!.tagline }}
              </p>
              <div class="mt-7 text-4xl font-extrabold">
                {{ money(item()!) }}
              </div>
              <div class="mt-1 text-xs text-slate-500">
                One payment · lifetime download
              </div>
              <button
                (click)="buy()"
                [disabled]="!item()!.fileReady"
                class="mt-7 w-full rounded-xl bg-blue-600 py-4 font-['JetBrains_Mono'] text-xs font-bold uppercase !text-white disabled:bg-slate-300 dark:disabled:bg-slate-700"
              >
                {{
                  item()!.fileReady
                    ? 'Buy this template'
                    : 'Download coming soon'
                }}
              </button>
              <button
                (click)="add()"
                [disabled]="!item()!.fileReady"
                class="mt-3 w-full rounded-xl border border-slate-300 py-4 font-['JetBrains_Mono'] text-xs font-bold uppercase disabled:opacity-50 dark:border-white/20"
              >
                {{ cart.has(item()!.id) ? 'Already in cart' : 'Add to cart' }}
              </button>
              @if (item()!.previewUrl) {
                <a
                  [href]="item()!.previewUrl"
                  target="_blank"
                  rel="noopener"
                  class="mt-4 flex items-center justify-center gap-1 text-sm font-semibold text-blue-700 dark:text-blue-400"
                  >Open live preview
                  <span class="material-symbols-outlined text-base"
                    >open_in_new</span
                  ></a
                >
              }
              <div
                class="mt-7 border-t border-slate-200 pt-6 text-sm text-slate-600 dark:border-white/10 dark:text-slate-300"
              >
                <p class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-lg">lock</span>
                  Secure checkout
                </p>
                <p class="mt-3 flex items-center gap-2">
                  <span class="material-symbols-outlined text-lg"
                    >download</span
                  >
                  ZIP appears in your dashboard
                </p>
              </div>
            </aside>
          </div>
        }
      </div>
    </main>
  `,
})
export class TemplateDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(TemplatesService);
  private sanitizer = inject(DomSanitizer);
  cart = inject(TemplateCartService);
  item = signal<UiTemplate | null>(null);
  loading = signal(true);
  error = signal('');
  promoEmbedUrl = signal<SafeResourceUrl | null>(null);
  ngOnInit() {
    this.service.get(this.route.snapshot.paramMap.get('slug') || '').subscribe({
      next: (item) => {
        this.item.set(item);
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
    if (item) this.cart.add(item);
  }
  buy() {
    const item = this.item();
    if (!item) return;
    this.cart.add(item);
    this.router.navigate(['/cart']);
  }
  money(item: UiTemplate) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: item.currency,
      maximumFractionDigits: 0,
    }).format(item.price);
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
