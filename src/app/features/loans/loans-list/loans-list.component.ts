import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { LoanService } from '../../../core/services/loan/loan.service';
import { Loan } from '../../../shared/models/loan.model';

@Component({
  selector: 'app-loans-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './loans-list.component.html',
  styleUrl: './loans-list.component.scss'
})
export class LoansListComponent implements OnInit{
  loans: Loan[] = [];
  loading = true;
  error = '';

  constructor(private loanService: LoanService) {}

  ngOnInit(): void {
    this.loanService.getUserLoans().subscribe({
      next: (data: Loan[]) => {
        this.loans = data;
        this.loading = false;
      },
      error: (err: any) => {
        console.error(err);
        this.error = 'Erreur lors du chargement des prêts';
        this.loading = false;
      }
    });
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'approved': return 'text-success';
      case 'pending': return 'text-warning';
      case 'rejected':
      case 'cancelled':
      case 'overdue': return 'text-danger';
      case 'completed': return 'text-muted';
      default: return 'text-secondary';
    }
  }

}
