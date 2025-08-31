import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api/api.service';
import { CurrencyXofPipe } from '../../../shared/pipe/currency-xof.pipe';

@Component({
  selector: 'app-loan-management',
  standalone: true,
  imports: [CommonModule, NgClass, FormsModule, CurrencyXofPipe],
  providers: [DecimalPipe],
  templateUrl: './loan-management.component.html',
  styleUrl: './loan-management.component.scss'
})
export class LoanManagementComponent implements OnInit {
  loans: any[] = [];
  filters = { status: '', minAmount: null, maxAmount: null };
  page = 1;
  pageSize = 10;
  totalLoans = 0;
  selectedLoan: any = null;
  showModal = false;

  constructor(private api: ApiService, private http: HttpClient) {}

  ngOnInit(): void {
    this.loadLoans();
  }

  loadLoans(): void {
    const params: any = { page: this.page, pageSize: this.pageSize };
    Object.entries(this.filters).forEach(([k, v]) => v ? params[k] = v : null);

    this.api.get('admin/loans', { params }).subscribe({
      next: (res: any) => {
        this.loans = res.loans;
        this.totalLoans = res.total;
      },
      error: err => console.error(err)
    });
  }

  applyFilters(): void {
    this.page = 1;
    this.loadLoans();
  }

  resetFilters(): void {
    this.filters = { status: '', minAmount: null, maxAmount: null };
    this.applyFilters();
  }

  changePage(delta: number) {
    this.page = Math.max(1, this.page + delta);
    this.loadLoans();
  }

  approveLoan(loanId: string) {
    this.api.post(`admin/loans/${loanId}/approve`, {}).subscribe(() => {
      this.loans = this.loans.map(l => l.id === loanId ? { ...l, status: 'approved' } : l);
    });
  }

  activateLoan(loanId: string) {
    this.api.post(`admin/loans/${loanId}/activate`, {}).subscribe(() => {
      this.loans = this.loans.map(l => l.id === loanId ? { ...l, status: 'active' } : l);
    });
  }
  
  openDetails(loan: any) {
    this.selectedLoan = loan;
    this.showModal = true;
  }

  closeDetails() {
    this.showModal = false;
    this.selectedLoan = null;
  }

  exportCSV() {
    const csv = [
      ['ID', 'Client', 'Montant', 'Mensualité', 'Statut', 'Produit'],
      ...this.loans.map(l => [
        l.id, 
        `${l.user_firstname} ${l.user_lastname}`,
        l.amount, l.monthly_payment, l.status, l.product_name
      ])
    ].map(r => r.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `loans_page${this.page}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
}
