import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { UiTemplate } from './templates.service';

const STORAGE_KEY = 'technyks-ui-template-cart';

@Injectable({ providedIn: 'root' })
export class TemplateCartService {
  private platformId = inject(PLATFORM_ID);
  private itemsState = signal<UiTemplate[]>(this.read());

  items = this.itemsState.asReadonly();
  count = computed(() => this.itemsState().length);
  subtotal = computed(() => this.itemsState().reduce((sum, item) => sum + Number(item.price), 0));

  has(id: string) {
    return this.itemsState().some((item) => item.id === id);
  }

  add(item: UiTemplate) {
    if (!item.fileReady || this.has(item.id)) return;
    this.write([...this.itemsState(), item]);
  }

  remove(id: string) {
    this.write(this.itemsState().filter((item) => item.id !== id));
  }

  clear() {
    this.write([]);
  }

  syncWithCatalog(catalog: UiTemplate[]) {
    const selectedIds = new Set(this.itemsState().map((item) => item.id));
    this.write(
      catalog.filter((item) => selectedIds.has(item.id) && item.fileReady),
    );
  }

  private read(): UiTemplate[] {
    if (!isPlatformBrowser(this.platformId)) return [];
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  private write(items: UiTemplate[]) {
    this.itemsState.set(items);
    if (isPlatformBrowser(this.platformId)) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }
}
