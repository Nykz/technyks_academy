import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { AuthService } from './auth.service';

export interface Account {
  id: string;
  email: string;
  name: string;
  role: 'STUDENT' | 'ADMIN';
  avatarUrl: string | null;
  headline: string;
  bio: string;
  websiteUrl: string;
  linkedinUrl: string;
  githubUrl: string;
  twitterUrl: string;
  youtubeUrl: string;
  emailAnnouncements: boolean;
  hasPassword: boolean;
  googleLinked: boolean;
  createdAt: string | null;
}

export interface Purchase {
  id: string;
  date: string;
  items: { type: 'COURSE' | 'TEMPLATE' | 'MEMBERSHIP'; title: string; slug?: string }[];
  amount: number;
  currency: string;
  status: 'SUCCESS' | 'REFUNDED';
  couponCode: string | null;
  reference: string | null;
}

export type ProfileChanges = Partial<
  Pick<Account, 'name' | 'headline' | 'bio' | 'websiteUrl' | 'linkedinUrl' | 'githubUrl' | 'twitterUrl' | 'youtubeUrl'>
>;

/** The signed-in user's own account settings. */
@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  get(): Observable<Account> {
    return this.http.get<Account>('/api/account').pipe(tap((account) => this.sync(account)));
  }

  updateProfile(changes: ProfileChanges): Observable<Account> {
    return this.http.patch<Account>('/api/account/profile', changes).pipe(tap((account) => this.sync(account)));
  }

  updateNotifications(changes: { emailAnnouncements: boolean }): Observable<Account> {
    return this.http.patch<Account>('/api/account/notifications', changes);
  }

  uploadAvatar(file: Blob): Observable<Account> {
    const form = new FormData();
    form.append('file', file, 'avatar.jpg');
    return this.http.post<Account>('/api/account/avatar', form).pipe(tap((account) => this.sync(account)));
  }

  removeAvatar(): Observable<Account> {
    return this.http.delete<Account>('/api/account/avatar').pipe(tap((account) => this.sync(account)));
  }

  changePassword(body: { currentPassword?: string; newPassword: string }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>('/api/account/password', body);
  }

  purchases(): Observable<Purchase[]> {
    return this.http.get<Purchase[]>('/api/account/purchases');
  }

  /** Keeps the header avatar and name in step with the saved account. */
  private sync(account: Account) {
    this.auth.updateCachedUser({ name: account.name, avatarUrl: account.avatarUrl });
  }
}

/**
 * Square-crops an image around its centre and returns a 400×400 JPEG, so
 * profile photos are small and uniform (like Udemy's photo step).
 */
export async function squareJpeg(file: File, size = 400): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser cannot process images.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, size, size);
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  bitmap.close?.();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not process the image.'))),
      'image/jpeg',
      0.88,
    ),
  );
}
