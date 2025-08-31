import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AccountService {
  private balanceSubject = new BehaviorSubject<number>(0);
  balance$ = this.balanceSubject.asObservable();

  constructor(private http: HttpClient) {}

  getAccountBalance(): Observable<{ balance: number }> {
    return this.http.get<{ balance: number }>(`${environment.apiUrl}/transactions/balance`);
  }

  refreshBalance() {
    this.getAccountBalance().subscribe({
      next: res => this.balanceSubject.next(res.balance),
      error: err => console.error('❌ Erreur mise à jour solde', err)
    });
  }

  verifyPassword(password: string) {
    return this.http.post<{ success: boolean }>(
      `${environment.apiUrl}/accounts/verify-password`,
      { password },
      { withCredentials: true } // si tu utilises cookies/session
    );
  }

}
