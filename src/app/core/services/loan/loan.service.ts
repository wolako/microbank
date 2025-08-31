import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { LoanCalculation, LoanProduct, Installment, Loan } from '../../../shared/models/loan.model';
import { LoanStats } from '../../../shared/models/loan.model';

@Injectable({
  providedIn: 'root'
})
export class LoanService {
  private apiUrl = `${environment.apiUrl}/loans`;

  constructor(private http: HttpClient) { }

  getLoanProducts(): Observable<LoanProduct[]> {
    return this.http.get<LoanProduct[]>(`${this.apiUrl}/products`);
  }

  calculateLoan(productId: string, amount: number, term: number): Observable<LoanCalculation> {
    return this.http.post<LoanCalculation>(`${this.apiUrl}/calculate`, {
      productId,
      amount,
      term
    });
  }

  applyForLoan(application: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/request`, application);
  }

  getUpcomingInstallments(): Observable<Installment[]> {
    return this.http.get<Installment[]>(`${this.apiUrl}/installments/upcoming`);
  }

  getLoanProductById(id: string): Observable<LoanProduct> {
    return this.http.get<LoanProduct>(`${this.apiUrl}/products/${id}`);
  }

  getLoanDetails(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${id}`);
  }

  getUserLoans(): Observable<Loan[]> {
    return this.http.get<Loan[]>(`${this.apiUrl}`);
  }

  getLoanDistribution(): Observable<{ active: number, completed: number, overdue: number }> {
    return this.http.get<{ active: number, completed: number, overdue: number }>(
      `${this.apiUrl}/distribution`
    );
  }

  getMonthlyPaymentStats(): Observable<{ year: number, month: number, total: number }[]> {
    return this.http.get<{ year: number, month: number, total: number }[]>(
      `${this.apiUrl}/payments/monthly`
    );
  }

  repayLoan(payload: { loanId: string, amount: number, method: string }) {
    return this.http.post(`${this.apiUrl}/${payload.loanId}/repay`, payload);
  }

  getLoanStatistics(): Observable<LoanStats> {
    return this.http.get<LoanStats>(`${this.apiUrl}/statistics`);
  }
} 