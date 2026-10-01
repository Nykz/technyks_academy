import { Component, computed, input, signal } from '@angular/core';
import { resolveMediaUrl } from '../../utils/media-url';

/** "Nikhil Agarwal" → "NA", "nikhil" → "N", "" → "?". */
export function initialsOf(name: string | null | undefined): string {
  const words = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter((word) => /\p{L}|\p{N}/u.test(word));
  if (!words.length) return '?';
  const first = [...words[0]][0] ?? '';
  const last = words.length > 1 ? ([...words[words.length - 1]][0] ?? '') : '';
  return (first + last).toUpperCase();
}

/**
 * Profile picture: the user's photo (uploaded or from Google), or their
 * initials on a gray circle when there is none or it fails to load.
 */
@Component({
  selector: 'app-user-avatar',
  standalone: true,
  host: { class: 'inline-block shrink-0' },
  template: `
    @if (photo() && failedSrc() !== photo()) {
      <img
        [src]="photo()"
        [alt]="name() || 'Profile photo'"
        [style.width.px]="size()"
        [style.height.px]="size()"
        class="rounded-full object-cover"
        referrerpolicy="no-referrer"
        (error)="failedSrc.set(photo())"
      />
    } @else {
      <span
        class="flex items-center justify-center rounded-full font-bold select-none"
        [style.width.px]="size()"
        [style.height.px]="size()"
        [style.font-size.px]="size() * 0.4"
        style="background:#4b5563;color:#ffffff;letter-spacing:.02em"
        role="img"
        [attr.aria-label]="name() || 'User'"
        >{{ initials() }}</span
      >
    }
  `,
})
export class UserAvatarComponent {
  readonly name = input<string | null | undefined>('');
  readonly src = input<string | null | undefined>(null);
  readonly size = input(40);

  /** A photo that failed to load (e.g. expired Google link) shows initials. */
  readonly failedSrc = signal<string | null>(null);
  readonly photo = computed(() => resolveMediaUrl(this.src()));
  readonly initials = computed(() => initialsOf(this.name()));
}
