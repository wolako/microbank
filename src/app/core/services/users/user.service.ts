import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) { }

  // ---------------- Profil ----------------
  getProfile(): Observable<any> {
    return this.http.get(`${this.apiUrl}/profile`);
  }

  updateProfile(profileData: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/profile`, profileData);
  }

  changePassword(passwordData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/change-password`, passwordData);
  }

  getPreferences(): Observable<any> {
    return this.http.get(`${this.apiUrl}/preferences`);
  }

  updatePreferences(data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/preferences`, data);
  }

  updateNotificationPreferences(prefs: {
    email_notifications_enabled: boolean;
    sms_notifications_enabled: boolean;
  }): Observable<any> {
    return this.http.put(`${this.apiUrl}/notifications`, prefs);
  }

  // ---------------- 2FA ----------------
  setupTwoFactor(): Observable<{ qrDataUrl: string; secret: string }> {
    return this.http.get<{ qrDataUrl: string; secret: string }>(`${this.apiUrl}/2fa/setup`);
  }

  verifyTwoFactor(token: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.apiUrl}/2fa/verify`, { token });
  }

  disableTwoFactor(): Observable<{ success: boolean }> {
    return this.http.put<{ success: boolean }>(`${this.apiUrl}/2fa/disable`, {});
  }
}
