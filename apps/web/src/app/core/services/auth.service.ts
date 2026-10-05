import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, Observable } from 'rxjs';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'STUDENT' | 'ADMIN';
  avatarUrl?: string | null;
  onboardingCompleted?: boolean;
  learnerGoal?: string | null;
  experienceLevel?: string | null;
  membershipPreference?: string | null;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
  requiresOnboarding?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  currentUser = signal<User | null>(null);
  isAuthenticated = computed(() => !!this.currentUser());
  isAdmin = computed(() => this.currentUser()?.role === 'ADMIN');
  tokenKey = 'technyks_auth_token';
  userKey = 'technyks_auth_user';
  private onboardingKey = 'technyks_onboarding_pending';
  onboardingPending = signal(false);

  constructor() {
    this.loadInitialUser();
    this.onboardingPending.set(this.readOnboardingPending());
  }

  getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(this.tokenKey);
    }
    return null;
  }

  private loadInitialUser() {
    if (typeof window !== 'undefined') {
      // A session that has already expired (sessions last 7 days) would make
      // every signed-in request fail; start signed out instead.
      const token = localStorage.getItem(this.tokenKey);
      if (token && isExpiredToken(token)) {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
        return;
      }
      const savedUser = localStorage.getItem(this.userKey);
      if (savedUser) {
        try {
          this.currentUser.set(JSON.parse(savedUser));
        } catch {
          // Ignore a malformed cached session and continue signed out.
        }
      }
    }
  }

  login(credentials: {
    email: string;
    password: string;
  }): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>('/api/auth/login', credentials)
      .pipe(tap((res) => this.setSession(res)));
  }

  signup(data: {
    email: string;
    password: string;
    name: string;
  }): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>('/api/auth/signup', data)
      .pipe(tap((res) => this.setSession(res)));
  }

  getPublicAuthConfig(): Observable<{ googleClientId: string | null }> {
    return this.http.get<{ googleClientId: string | null }>('/api/auth/config');
  }

  loginWithGoogle(credential: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>('/api/auth/google', { credential })
      .pipe(tap((response) => this.setSession(response)));
  }

  getProfile(): Observable<User> {
    return this.http.get<User>('/api/auth/me').pipe(
      tap((user) => {
        this.persistUser(user);
        if (user.onboardingCompleted === true) {
          this.setOnboardingPending(false);
        }
      }),
    );
  }

  completeOnboarding(payload: {
    learnerGoal: string;
    experienceLevel: string;
    membershipPreference: string;
  }): Observable<User> {
    return this.http.patch<User>('/api/auth/onboarding', payload).pipe(
      tap((user) => {
        this.persistUser(user);
        this.setOnboardingPending(false);
      }),
    );
  }

  needsOnboarding(): boolean {
    return Boolean(
      this.currentUser()?.role !== 'ADMIN' && this.onboardingPending(),
    );
  }

  private setSession(res: AuthResponse) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.tokenKey, res.accessToken);
      localStorage.setItem(this.userKey, JSON.stringify(res.user));
    }
    this.currentUser.set(res.user);
    this.setOnboardingPending(
      res.requiresOnboarding === true && res.user.onboardingCompleted !== true,
    );
  }

  private readOnboardingPending(): boolean {
    if (typeof sessionStorage === 'undefined') return false;
    try {
      return sessionStorage.getItem(this.onboardingKey) === '1';
    } catch {
      return false;
    }
  }

  private setOnboardingPending(pending: boolean) {
    this.onboardingPending.set(pending);
    if (typeof sessionStorage === 'undefined') return;
    try {
      if (pending) sessionStorage.setItem(this.onboardingKey, '1');
      else sessionStorage.removeItem(this.onboardingKey);
    } catch {
      // Session persistence is optional; the in-memory signal still works.
    }
  }

  /** Applies account changes (name, photo) to the signed-in user everywhere. */
  updateCachedUser(changes: Partial<User>) {
    const current = this.currentUser();
    if (current) this.persistUser({ ...current, ...changes });
  }

  private persistUser(user: User) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.userKey, JSON.stringify(user));
    }
    this.currentUser.set(user);
  }

  forgotPassword(email: string) {
    return this.http.post<{ message: string }>(
      '/api/auth/forgot-password',
      { email },
    );
  }

  resetPassword(token: string, newPassword?: string) {
    return this.http.post<{ message: string }>('/api/auth/reset-password', {
      token,
      newPassword,
    });
  }

  /**
   * The server refused this session (expired or no longer valid): sign out
   * and send the user to login, then back to where they were.
   */
  expireSession() {
    if (typeof window === 'undefined' || !this.getToken()) return;
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    this.setOnboardingPending(false);
    this.currentUser.set(null);
    const current = this.router.url || '/';
    this.router.navigate(['/auth/login'], {
      queryParams: { expired: 1, ...(current.startsWith('/auth') ? {} : { returnUrl: current }) },
    });
  }

  logout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.tokenKey);
      localStorage.removeItem(this.userKey);
    }
    this.setOnboardingPending(false);
    this.currentUser.set(null);
    this.router.navigate(['/auth/login']);
  }
}

/** True when a JWT's "exp" time has passed (or the token can't be read). */
export function isExpiredToken(token: string, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  try {
    const part = token.split('.')[1];
    if (!part) return true;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='));
    const exp = Number(JSON.parse(json)?.exp);
    return Number.isFinite(exp) ? exp <= nowSeconds : false;
  } catch {
    return true;
  }
}
