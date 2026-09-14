import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UiTemplate {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  thumbnail?: string | null;
  promoVideoUrl?: string | null;
  previewUrl?: string | null;
  price: number;
  currency: string;
  category: string;
  tags: string[];
  isFeatured: boolean;
  fileReady: boolean;
  downloadButtonText?: string | null;
  buyerMessage?: string | null;
  deliveryType?: 'file' | 'external';
  updatedAt?: string;
}

export interface AdminUiTemplate extends UiTemplate {
  isPublished: boolean;
  fileName?: string | null;
  fileSize?: number;
  deliveryUrl?: string | null;
  createdAt?: string;
}

export interface TemplatePurchase {
  id: string;
  purchasedAt: string;
  amount: number;
  currency: string;
  product: UiTemplate;
}

export interface TemplateDelivery {
  type: 'file' | 'external';
  url?: string;
  buttonText: string;
  fileName?: string;
}

export interface TemplateOrder {
  id: string;
  purchasedAt: string;
  amount: number;
  currency: string;
  paymentId?: string | null;
  status: 'COMPLETED';
  product: { id: string; slug: string; title: string };
  buyer: { id: string; name: string; email: string };
}

@Injectable({ providedIn: 'root' })
export class TemplatesService {
  private http = inject(HttpClient);

  list(): Observable<UiTemplate[]> {
    return this.http.get<UiTemplate[]>('/api/templates');
  }

  get(slug: string): Observable<UiTemplate> {
    return this.http.get<UiTemplate>(
      `/api/templates/${encodeURIComponent(slug)}`,
    );
  }

  purchases(): Observable<TemplatePurchase[]> {
    return this.http.get<TemplatePurchase[]>('/api/templates/purchases/my');
  }

  download(productId: string): Observable<Blob> {
    return this.http.get(
      `/api/templates/${encodeURIComponent(productId)}/download`,
      {
        responseType: 'blob',
      },
    );
  }

  delivery(productId: string): Observable<TemplateDelivery> {
    return this.http.get<TemplateDelivery>(
      `/api/templates/${encodeURIComponent(productId)}/delivery`,
    );
  }

  listAdmin(): Observable<AdminUiTemplate[]> {
    return this.http.get<AdminUiTemplate[]>('/api/admin/templates');
  }

  getAdmin(id: string): Observable<AdminUiTemplate> {
    return this.http.get<AdminUiTemplate>(
      `/api/admin/templates/${encodeURIComponent(id)}`,
    );
  }

  listOrders(): Observable<TemplateOrder[]> {
    return this.http.get<TemplateOrder[]>('/api/admin/templates/orders');
  }

  create(input: Partial<AdminUiTemplate>): Observable<AdminUiTemplate> {
    return this.http.post<AdminUiTemplate>('/api/admin/templates', input);
  }

  update(
    id: string,
    input: Partial<AdminUiTemplate>,
  ): Observable<AdminUiTemplate> {
    return this.http.patch<AdminUiTemplate>(
      `/api/admin/templates/${encodeURIComponent(id)}`,
      input,
    );
  }

  upload(id: string, file: File): Observable<AdminUiTemplate> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<AdminUiTemplate>(
      `/api/admin/templates/${encodeURIComponent(id)}/file`,
      form,
    );
  }

  uploadMedia(
    kind: 'image' | 'video',
    file: File,
  ): Observable<{
    url: string;
    filename: string;
    mimeType: string;
    size: number;
  }> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<{
      url: string;
      filename: string;
      mimeType: string;
      size: number;
    }>(`/api/admin/media/${kind}`, form);
  }

  removeMedia(url: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `/api/admin/media?url=${encodeURIComponent(url)}`,
    );
  }

  remove(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `/api/admin/templates/${encodeURIComponent(id)}`,
    );
  }

  saveBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }
}
