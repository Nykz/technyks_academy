import { Injectable, signal } from '@angular/core';

const THEME_STORAGE_KEY = 'technyks-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  isDarkMode = signal(this.readStoredTheme());

  constructor() {
    this.applyTheme(this.isDarkMode());
  }

  toggle() {
    this.setDarkMode(!this.isDarkMode());
  }

  setDarkMode(isDark: boolean) {
    this.isDarkMode.set(isDark);
    this.applyTheme(isDark);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
    } catch {
      // The visual switch still works if browser storage is unavailable.
    }
  }

  /** Light mode by default; dark only when the visitor chose it. */
  private readStoredTheme(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) === 'dark';
    } catch {
      return false;
    }
  }

  private applyTheme(isDark: boolean) {
    if (typeof document === 'undefined') return;
    const docEl = document.documentElement;
    const body = document.body;
    docEl.classList.remove('theme-pending');

    if (isDark) {
      docEl.classList.add('dark', 'dark-theme');
      docEl.classList.remove('light-theme');
      body?.classList.add('dark', 'dark-theme');
      body?.classList.remove('light-theme');
    } else {
      docEl.classList.remove('dark', 'dark-theme');
      docEl.classList.add('light-theme');
      body?.classList.remove('dark', 'dark-theme');
      body?.classList.add('light-theme');
    }
  }
}
