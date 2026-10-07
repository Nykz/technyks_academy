import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, of, shareReplay, tap, throwError } from 'rxjs';

export interface AnnouncementBarSettings {
  enabled: boolean;
  message: string;
  buttonText: string;
  buttonUrl: string;
  badgeText?: string;
  theme: 'blue' | 'amber' | 'emerald' | 'purple';
}

export interface SiteSettings {
  typingWords: string[];
  announcementBar: AnnouncementBarSettings;
}

const SITE_SETTINGS_STORAGE_KEY = 'technyks_site_settings_v2';

const DEFAULT_SETTINGS: SiteSettings = {
  typingWords: ['NN', 'Full Stack', 'Data Science', 'Data Engineering'],
  announcementBar: {
    enabled: true,
    message: '🚀 Special Launch: Complete TypeScript & JavaScript Masterclasses are now LIVE!',
    buttonText: 'Explore Courses',
    buttonUrl: '/courses',
    badgeText: 'NEW',
    theme: 'blue',
  },
};

@Injectable({
  providedIn: 'root',
})
export class SiteSettingsService {
  private http = inject(HttpClient);
  private remoteSettingsRequest$?: Observable<SiteSettings | null>;

  settings = signal<SiteSettings>(this.loadStoredSettings());
  isDismissed = signal(false);

  constructor() {
    this.fetchRemoteSettings().subscribe();
  }

  private loadStoredSettings(): SiteSettings {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(SITE_SETTINGS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          return {
            typingWords: Array.isArray(parsed.typingWords) && parsed.typingWords.length
              ? parsed.typingWords
              : DEFAULT_SETTINGS.typingWords,
            announcementBar: {
              ...DEFAULT_SETTINGS.announcementBar,
              ...(parsed.announcementBar || {}),
            },
          };
        }
      } catch {
        // Fallback to default on storage parse error
      }
    }
    return DEFAULT_SETTINGS;
  }

  private saveLocalSettings(settings: SiteSettings) {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(SITE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      } catch {
        // Ignore quota errors
      }
    }
    this.settings.set(settings);
  }

  fetchRemoteSettings(): Observable<SiteSettings | null> {
    if (this.remoteSettingsRequest$) return this.remoteSettingsRequest$;

    this.remoteSettingsRequest$ = this.http
      .get<Partial<SiteSettings>>('/api/settings')
      .pipe(
        catchError(() => of(null)),
        map((remote) => {
          if (!remote) return null;
          return {
            typingWords:
              Array.isArray(remote.typingWords) && remote.typingWords.length
                ? remote.typingWords
                : this.settings().typingWords,
            announcementBar: {
              ...this.settings().announcementBar,
              ...(remote.announcementBar || {}),
            },
          } satisfies SiteSettings;
        }),
        tap((remote) => {
          if (remote) this.saveLocalSettings(remote);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    return this.remoteSettingsRequest$;
  }

  updateSettings(updated: Partial<SiteSettings>): Observable<SiteSettings> {
    const current = this.settings();
    const newSettings: SiteSettings = {
      ...current,
      ...updated,
      announcementBar: {
        ...current.announcementBar,
        ...(updated.announcementBar || {}),
      },
    };
    this.saveLocalSettings(newSettings);

    return this.http
      .post<Partial<SiteSettings>>('/api/admin/settings', newSettings)
      .pipe(
        map((saved) => ({
          typingWords:
            Array.isArray(saved.typingWords) && saved.typingWords.length
              ? saved.typingWords
              : newSettings.typingWords,
          announcementBar: {
            ...newSettings.announcementBar,
            ...(saved.announcementBar || {}),
          },
        })),
        tap((saved) => this.saveLocalSettings(saved)),
        // The server did not save it: show the real (unchanged) settings
        // again instead of leaving the unsaved version on this screen.
        catchError((error) => {
          this.saveLocalSettings(current);
          return throwError(() => error);
        }),
      );
  }

  dismissAnnouncement() {
    this.isDismissed.set(true);
  }
}
