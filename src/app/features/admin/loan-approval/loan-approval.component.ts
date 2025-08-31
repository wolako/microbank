import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../../core/services/api/api.service';

@Component({
  selector: 'app-loan-approval',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './loan-approval.component.html',
  styleUrl: './loan-approval.component.scss'
})
export class LoanApprovalComponent implements OnInit {
  pendingLoans: any[] = [];

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadPendingLoans();
  }

  loadPendingLoans() {
    this.api.get('admin/loans/pending').subscribe({
      next: (res: any) => this.pendingLoans = res,
      error: err => console.error(err)
    });
  }

  approve(id: string) {
    this.api.post(`admin/loans/${id}/approve`, {}).subscribe({
      next: () => this.loadPendingLoans(),
      error: err => console.error(err)
    });
  }

  reject(id: string) {
    this.api.post(`admin/loans/${id}/reject`, {}).subscribe({
      next: () => this.loadPendingLoans(),
      error: err => console.error(err)
    });
  }

}
