import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  isActive: boolean;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = `${environment.apiUrl}/auth`;

  // Reactive signal for the current user (used across components)
  currentUser = signal<AuthUser | null>(this.loadUserFromStorage());

  constructor(private http: HttpClient, private router: Router) {}

  // ── Login ──────────────────────────────────────────────────────────────────
  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, { email, password }).pipe(
      tap((res) => {
        localStorage.setItem('hms_token', res.token);
        localStorage.setItem('hms_user', JSON.stringify(res.user));
        this.currentUser.set(res.user);
      })
    );
  }
  // ── Register ───────────────────────────────────────────────────────────────
  register(userData: any): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/register`, userData).pipe(
      tap((res) => {
        localStorage.setItem('hms_token', res.token);
        localStorage.setItem('hms_user', JSON.stringify(res.user));
        this.currentUser.set(res.user);
      })
    );
  }


  // ── Logout ─────────────────────────────────────────────────────────────────
  logout(): void {
    localStorage.removeItem('hms_token');
    localStorage.removeItem('hms_user');
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  // ── Token helpers ──────────────────────────────────────────────────────────
  getToken(): string | null {
    return localStorage.getItem('hms_token');
  }

  isLoggedIn(): boolean {
    const token = this.getToken();
    if (!token) return false;

    try {
      // Decode payload to check expiry
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  // ── Role helpers ───────────────────────────────────────────────────────────
  getRole(): string | null {
    return this.currentUser()?.role ?? null;
  }

  hasRole(...roles: string[]): boolean {
    const role = this.getRole();
    return role !== null && roles.includes(role);
  }

  isAdmin(): boolean {
    return this.hasRole('Admin');
  }

  // ── Private helpers ────────────────────────────────────────────────────────
  private loadUserFromStorage(): AuthUser | null {
    try {
      const raw = localStorage.getItem('hms_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
