import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type AnnouncementTheme = 'blue' | 'amber' | 'emerald' | 'purple';

export interface SiteSettings {
  typingWords: string[];
  announcementBar: {
    enabled: boolean;
    message: string;
    buttonText: string;
    buttonUrl: string;
    badgeText: string;
    theme: AnnouncementTheme;
  };
}

const SETTINGS_KEY = 'site';
const THEMES = new Set<AnnouncementTheme>([
  'blue',
  'amber',
  'emerald',
  'purple',
]);

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  typingWords: ['NN', 'Full Stack', 'Data Science', 'Data Engineering'],
  announcementBar: {
    enabled: true,
    message:
      '🚀 Special Launch: Complete TypeScript & JavaScript Masterclasses are now LIVE!',
    buttonText: 'Explore Courses',
    buttonUrl: '/courses',
    badgeText: 'NEW',
    theme: 'blue',
  },
};

@Injectable()
export class SiteSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<SiteSettings> {
    if (this.prisma.isDbConnected) {
      try {
        const stored = await this.prisma.siteSetting.findUnique({
          where: { key: SETTINGS_KEY },
        });
        if (stored) return this.normalise(stored.value);
      } catch {
        // Fall through to the local adapter if the settings table is not yet available.
      }
    }

    return this.normalise(
      this.prisma.inMemorySiteSettings || DEFAULT_SITE_SETTINGS,
    );
  }

  async updateSettings(input: unknown): Promise<SiteSettings> {
    const settings = this.normalise(input, true);

    if (this.prisma.isDbConnected) {
      try {
        const saved = await this.prisma.siteSetting.upsert({
          where: { key: SETTINGS_KEY },
          create: { key: SETTINGS_KEY, value: settings as any },
          update: { value: settings as any },
        });
        return this.normalise(saved.value);
      } catch (error: any) {
        // Saving only in this server's memory would show the change on one
        // server, lose it on restart, and still tell the admin it was saved.
        new Logger(SiteSettingsService.name).error(
          `Could not save site settings: ${error?.message || error}`,
        );
        throw new ServiceUnavailableException('Settings could not be saved right now. Please try again.');
      }
    }

    this.prisma.inMemorySiteSettings = structuredClone(settings);
    return settings;
  }

  private normalise(input: any, validateRequired = false): SiteSettings {
    const rawWords = Array.isArray(input?.typingWords)
      ? input.typingWords
      : DEFAULT_SITE_SETTINGS.typingWords;
    const cleanedWords: string[] = rawWords
      .map((word: unknown) => String(word || '').trim().slice(0, 40))
      .filter((word: string) => Boolean(word));
    const typingWords = [...new Set<string>(cleanedWords)].slice(0, 20);

    if (validateRequired && typingWords.length === 0) {
      throw new BadRequestException(
        'Add at least one hero typing word before saving.',
      );
    }

    const rawBar = input?.announcementBar || {};
    const theme = THEMES.has(rawBar.theme)
      ? rawBar.theme
      : DEFAULT_SITE_SETTINGS.announcementBar.theme;
    const buttonUrl = this.normaliseUrl(rawBar.buttonUrl);

    return {
      typingWords: typingWords.length
        ? typingWords
        : [...DEFAULT_SITE_SETTINGS.typingWords],
      announcementBar: {
        enabled: Boolean(rawBar.enabled),
        message: String(
          rawBar.message ?? DEFAULT_SITE_SETTINGS.announcementBar.message,
        )
          .trim()
          .slice(0, 240),
        buttonText: String(
          rawBar.buttonText ??
            DEFAULT_SITE_SETTINGS.announcementBar.buttonText,
        )
          .trim()
          .slice(0, 60),
        buttonUrl,
        badgeText: String(
          rawBar.badgeText ?? DEFAULT_SITE_SETTINGS.announcementBar.badgeText,
        )
          .trim()
          .slice(0, 32),
        theme,
      },
    };
  }

  private normaliseUrl(value: unknown): string {
    const url = String(
      value ?? DEFAULT_SITE_SETTINGS.announcementBar.buttonUrl,
    )
      .trim()
      .slice(0, 500);
    if (!url) return '';
    if (/^(\/[^/]|#)/.test(url) || /^https?:\/\//i.test(url)) return url;
    throw new BadRequestException(
      'Banner button URL must be an internal path, anchor, or an HTTP(S) URL.',
    );
  }
}
