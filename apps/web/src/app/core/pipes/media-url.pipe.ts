import { Pipe, PipeTransform } from '@angular/core';
import { resolveMediaUrl } from '../utils/media-url';

/**
 * Resolves a stored thumbnail/video path (which may be a relative
 * "/uploads/..." path served by the API, a bundled "/assets/..." path, a
 * data: URI, or an already-absolute http(s) URL) to a URL that always loads
 * correctly regardless of which origin the page itself is served from.
 *
 * Usage: `<img [src]="course.thumbnail | mediaUrl">`
 */
@Pipe({
  name: 'mediaUrl',
  standalone: true,
  pure: true,
})
export class MediaUrlPipe implements PipeTransform {
  transform(value: string | null | undefined): string | null {
    return resolveMediaUrl(value);
  }
}
