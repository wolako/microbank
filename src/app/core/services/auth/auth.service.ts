import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { UserProfile } from '../../../shared/models/dashboard.model';
import { AuthResponse } from '../../../shared/models/auth-response.model';
import { environment } from '../../../../environments/environment';
import { RegisterRequest } from '../../../shared/models/register-request.model';
import { catchError, map, tap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = environment.apiUrl;
  private authState = new BehaviorSubject<boolean>(false);
  isAuthenticated$ = this.authState.asObservable();
  private currentUser = new BehaviorSubject<UserProfile | null>(null);
  public user$ = this.currentUser.asObservable();

  constructor(private http: HttpClient, private router: Router) {}

  // ==========================
  // Profil utilisateur
  // ==========================
  getUserProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.apiUrl}/auth/profile`).pipe(
      tap(user => {
        this.currentUser.next(user);
        this.authState.next(true);
      }),
      catchError(err => {
        console.error('Erreur lors de la récupération du profil:', err);
        throw err;
      })
    );
  }

  // ==========================
  // Login avec distinction user/admin
  // ==========================
  login(credentials: { login: string; password: string }, loginType: 'user' | 'admin' = 'user'): Observable<any> {
    const url = loginType === 'admin' ? `${this.apiUrl}/auth/admin/login` : `${this.apiUrl}/auth/login`;

    return this.http.post<any>(url, credentials).pipe(
      map(res => ({
        user: res.user,
        token: res.token || null,
        twoFactorRequired: res.twoFactorRequired || false,
        success: res.success,
        message: res.message
      })),
      tap(res => {
        if (res.success && res.user && res.token) {
          localStorage.setItem('auth_token', res.token);
          this.currentUser.next(res.user);
          this.authState.next(true);

          // Redirection automatique selon le rôle
          const target = this.getTargetRoute(res.user.role);
          this.router.navigate([target]);
        }
      }),
      catchError(err => {
        const backendError = err?.error?.error;
        if (backendError === 'EMAIL_NOT_VERIFIED') {
          this.router.navigate(['/auth/verify-email']);
        } else if (backendError === 'ACCOUNT_NOT_APPROVED') {
          this.router.navigate(['/auth/pending-approval']);
        } else if (backendError === 'ROLE_NOT_ALLOWED') {
          // Redirige vers la page de login appropriée
          if (loginType === 'admin') {
            this.router.navigate(['/auth/admin/login']);
          } else {
            this.router.navigate(['/auth/login']);
          }
        }
        return throwError(() => err);
      })
    );
  }

  // ==========================
  // Validation 2FA après login
  // ==========================
  validate2FAToken(userId: string, token: string): Observable<AuthResponse> {
    return this.http.post<any>(`${this.apiUrl}/2fa/validate`, { userId, token }).pipe(
      map(res => ({
        user: res.user || null,
        token: res.token,
        success: res.success,
        message: res.message
      })),
      tap(response => {
        if (!response.token) throw new Error('Réponse 2FA invalide');
        localStorage.setItem('auth_token', response.token);
        this.refreshUser();
      }),
      catchError(err => {
        console.error('Erreur validate2FAToken:', err);
        return throwError(() => err);
      })
    );
  }

  // ==========================
  // Vérification 2FA côté frontend
  // ==========================
  is2FAValid(expirationMinutes = 10): boolean {
    const user = this.currentUser.value;
    if (!user?.two_factor_validated_at) return false;

    const validatedAt = new Date(user.two_factor_validated_at).getTime();
    const now = Date.now();
    const diffMinutes = (now - validatedAt) / 1000 / 60;

    return diffMinutes <= expirationMinutes;
  }

  // ==========================
  // Gestion 2FA
  // ==========================
  enable2FA(token: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/2fa/verify`, { token }).pipe(
      tap(() => this.refreshUser())
    );
  }

  disable2FA(): Observable<any> {
    return this.http.post(`${this.apiUrl}/2fa/disable`, {}).pipe(
      tap(() => this.refreshUser())
    );
  }

  // ==========================
  // Logout
  // ==========================
  logout(): void {
    localStorage.removeItem('auth_token');
    this.currentUser.next(null);
    this.authState.next(false);
    this.router.navigate(['/auth/login']);
  }

  // ==========================
  // Helpers
  // ==========================
  refreshUser(): void {
    this.getUserProfile().subscribe({
      next: user => this.currentUser.next(user),
      error: err => {
        console.error('Erreur refreshUser:', err);
        this.currentUser.next(null);
        this.authState.next(false);
      }
    });
  }

  redirectToDashboard(): void {
    const user = this.currentUser.value;
    if (!user) {
      this.router.navigate(['/auth/login']);
      return;
    }
    const target = this.getTargetRoute(user.role);
    this.router.navigate([target]);
  }

  getCurrentUser(): Observable<UserProfile | null> {
    return this.currentUser.asObservable();
  }

  get currentUserValue(): UserProfile | null {
    return this.currentUser.value;
  }

  isLoggedIn(): boolean {
    return this.authState.value;
  }

  checkEmailExists(email: string): Observable<boolean> {
    const params = new HttpParams().set('email', email);
    return this.http.get<{ exists: boolean }>(`${this.apiUrl}/auth/check-email`, { params }).pipe(
      map(res => res.exists)
    );
  }

  ensureUserLoaded(): Observable<UserProfile | null> {
    const current = this.currentUser.value;
    const token = localStorage.getItem('auth_token');
    if (current) return of(current);
    if (!token) return of(null);

    return this.getUserProfile().pipe(
      catchError(err => {
        console.error('ensureUserLoaded error:', err);
        this.authState.next(false);
        this.currentUser.next(null);
        return of(null);
      })
    );
  }

  initializeAuthState(): Observable<boolean> {
    return this.getUserProfile().pipe(
      tap(user => {
        this.currentUser.next(user);
        this.authState.next(true);
      }),
      map(() => true),
      catchError(() => {
        this.clearAuth(false);
        return of(false);
      })
    );
  }

  clearAuth(redirect: boolean = true): void {
    this.authState.next(false);
    this.currentUser.next(null);
    localStorage.removeItem('auth_token');
    if (redirect) this.router.navigate(['/auth/login']);
  }

  resendVerificationEmail(): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/resend-confirmation`, {});
  }

  register(userData: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<any>(`${this.apiUrl}/auth/register`, userData).pipe(
      map(res => ({
        user: res.user,
        token: res.token,
        success: res.success,
        message: res.message
      })),
      tap(response => {
        if (response.success) {
          this.router.navigate(['/auth/login'], { state: { registrationSuccess: true, email: userData.email } });
        }
      }),
      catchError(err => {
        console.error('Registration error:', err);
        throw err;
      })
    );
  }

  requestPasswordReset(email: string) {
    return this.http.post(`${this.apiUrl}/auth/forgot-password`, { email });
  }

  private getTargetRoute(role: string): string {
    switch (role) {
      case 'admin':
      case 'account_manager':
      case 'loan_officer':
      case 'support':
        return '/admin'; // Tous les rôles back-office sur la même route de base
      case 'user':
        return '/dashboard';
      default:
        return '/unauthorized';
    }
  }
}
