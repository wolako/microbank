import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Transaction, TransactionPayload } from '../../../shared/models/dashboard.model';
import { AuthService } from '../auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class TransactionService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private authService: AuthService) {}

  // ===============================
  // Dépôts : crédit strict
  // ===============================
  createDepositTransaction(data: {
    type: 'deposit_mobile' | 'deposit_wire' | 'deposit_card' | 'deposit_manual',
    amount: number,
    description?: string,
    metadata?: any
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}/transactions/deposit`, data)
      .pipe(catchError(err => this.handle2FAError(err)));
  }

  createMobileMoneyDeposit(amount: number, phone: string, provider: string) {
    return this.createDepositTransaction({ type: 'deposit_mobile', amount, metadata: { phone, provider }, description: 'Dépôt Mobile Money' });
  }

  createCardDeposit(amount: number, card: { number: string; exp: string; cvv: string }) {
    return this.createDepositTransaction({ type: 'deposit_card', amount, metadata: { card }, description: 'Dépôt carte bancaire' });
  }

  createWireDeposit(amount: number, iban: string, bankName: string) {
    return this.createDepositTransaction({ type: 'deposit_wire', amount, metadata: { iban, bankName }, description: 'Dépôt par virement' });
  }

  createManualDeposit(amount: number) {
    return this.createDepositTransaction({ type: 'deposit_manual', amount, description: 'Dépôt manuel' });
  }

  // ===============================
  // Paiement facture : débit strict
  // ===============================
  createBillPayment(data: { type: string; reference: string; provider: string; amount: number }) {
    return this.http.post(`${this.apiUrl}/bills`, data)
      .pipe(catchError(err => this.handle2FAError(err)));
  }

  // ===============================
  // Retraits, transferts, achats : débit
  // ===============================
  createTransaction(data: TransactionPayload): Observable<any> {
    return this.http.post(`${this.apiUrl}/transactions`, data)
      .pipe(catchError(err => this.handle2FAError(err)));
  }

  // ===============================
  // Récupération solde et transactions
  // ===============================
  getAccountBalance(): Observable<{ balance: number }> {
    return this.http.get<{ balance: number }>(`${this.apiUrl}/transactions/balance`)
      .pipe(catchError(err => this.handle2FAError(err)));
  }

  getRecentTransactions(): Observable<Transaction[]> {
    return this.http.get<Transaction[]>(`${this.apiUrl}/transactions/recent`)
      .pipe(catchError(err => this.handle2FAError(err)));
  }

  getTransactionById(id: string): Observable<Transaction> {
    return this.http.get<Transaction>(`${this.apiUrl}/transactions/${id}`)
      .pipe(catchError(err => this.handle2FAError(err)));
  }

  getAllTransactions(): Observable<Transaction[]> {
    return this.http.get<Transaction[]>(`${this.apiUrl}/transactions`)
      .pipe(catchError(err => this.handle2FAError(err)));
  }

   // ===============================
  // Retraits ATM
  // ===============================
  createATMWithdrawal(amount: number) {
    // Crée la transaction pending + code ATM
    return this.http.post(`${this.apiUrl}/transactions/atm-withdrawal`, { amount })
      .pipe(catchError(err => this.handle2FAError(err)));
  }

  validateATMCode(atmWithdrawalId: string, code: string) {
    // Valide le code ATM en envoyant l'ID généré lors de la création
    return this.http.post(`${this.apiUrl}/transactions/atm-verify`, { atmWithdrawalId, code })
      .pipe(catchError(err => this.handle2FAError(err)));
  }

  // ===============================
  // Gestion des erreurs 2FA
  // ===============================
  private handle2FAError(err: any) {
    if (err.status === 403 && err.error?.message?.includes('2FA')) {
      return throwError(() => ({ ...err.error, is2FAExpired: true }));
    }
    return throwError(() => err);
  }
}
