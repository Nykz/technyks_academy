import { Component, computed, input, signal } from '@angular/core';
import { SafeResourceUrl } from '@angular/platform-browser';
import { MediaUrlPipe } from '../../core/pipes/media-url.pipe';

export type CarouselSlide =
  | { kind: 'image'; src: string; alt: string }
  | { kind: 'video'; src: string; poster?: string | null }
  | { kind: 'embed'; src: SafeResourceUrl; title: string };

/**
 * Product media slideshow: promo video or thumbnail first, then
 * screenshots. Swipe on touch screens, arrows / keyboard on desktop,
 * and a thumbnail strip to jump to any screen.
 */
@Component({
  selector: 'app-template-media-carousel',
  imports: [MediaUrlPipe],
  host: {
    class: 'block',
    '(keydown.arrowleft)': 'previous()',
    '(keydown.arrowright)': 'next()',
  },
  template: `
    <div
      class="relative aspect-video overflow-hidden rounded-2xl bg-[#0B1220] shadow-2xl outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      tabindex="0"
      role="region"
      aria-roledescription="carousel"
      [attr.aria-label]="label() + ' media'"
      (pointerdown)="onPointerDown($event)"
      (pointerup)="onPointerUp($event)"
      (pointercancel)="startX = null"
    >
      @if (current(); as slide) {
        @switch (slide.kind) {
          @case ('video') {
            <video [src]="slide.src | mediaUrl" controls playsinline preload="metadata"
              [poster]="(slide.poster | mediaUrl) || undefined"
              class="h-full w-full object-contain"></video>
          }
          @case ('embed') {
            <iframe [src]="slide.src" [title]="slide.title" class="h-full w-full border-0"
              allow="autoplay; encrypted-media; picture-in-picture"
              referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
          }
          @default {
            <img [src]="slide.src | mediaUrl" [alt]="slide.alt" draggable="false"
              [attr.loading]="index() === 0 ? 'eager' : 'lazy'"
              class="h-full w-full select-none object-contain" />
          }
        }
      }

      @if (slides().length > 1) {
        <button type="button" (click)="previous()" aria-label="Previous screen"
          class="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/55 !text-white backdrop-blur hover:bg-black/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
          <span class="material-symbols-outlined" aria-hidden="true">chevron_left</span>
        </button>
        <button type="button" (click)="next()" aria-label="Next screen"
          class="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/55 !text-white backdrop-blur hover:bg-black/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
          <span class="material-symbols-outlined" aria-hidden="true">chevron_right</span>
        </button>
        <span class="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 font-['JetBrains_Mono'] text-[11px] font-bold !text-white"
          aria-live="polite">{{ index() + 1 }} / {{ slides().length }}</span>
      }
    </div>

    @if (slides().length > 1) {
      <div class="mt-3 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Choose a screen">
        @for (slide of slides(); track $index) {
          <button type="button" role="tab" (click)="index.set($index)"
            [attr.aria-selected]="$index === index()"
            [attr.aria-label]="'Show screen ' + ($index + 1)"
            class="h-14 w-24 shrink-0 overflow-hidden rounded-lg border-2 bg-[#0B1220] transition-opacity"
            [class]="$index === index() ? 'border-blue-600 opacity-100' : 'border-transparent opacity-60 hover:opacity-100'">
            @if (slide.kind === 'image') {
              <img [src]="slide.src | mediaUrl" alt="" loading="lazy" class="h-full w-full object-cover" />
            } @else {
              <span class="grid h-full w-full place-items-center !text-white">
                <span class="material-symbols-outlined" aria-hidden="true">play_circle</span>
              </span>
            }
          </button>
        }
      </div>
    }
  `,
})
export class TemplateMediaCarouselComponent {
  readonly slides = input.required<CarouselSlide[]>();
  readonly label = input('Template');

  readonly index = signal(0);
  readonly current = computed(() => {
    const slides = this.slides();
    return slides[Math.min(this.index(), slides.length - 1)] ?? null;
  });

  startX: number | null = null;

  next() {
    const count = this.slides().length;
    if (count) this.index.update((i) => (i + 1) % count);
  }

  previous() {
    const count = this.slides().length;
    if (count) this.index.update((i) => (i - 1 + count) % count);
  }

  onPointerDown(event: PointerEvent) {
    // Swipes only on touch/pen; videos and iframes keep their own controls.
    this.startX = event.pointerType === 'mouse' ? null : event.clientX;
  }

  onPointerUp(event: PointerEvent) {
    if (this.startX === null) return;
    const distance = event.clientX - this.startX;
    this.startX = null;
    if (Math.abs(distance) < 40) return;
    if (distance < 0) this.next();
    else this.previous();
  }
}
