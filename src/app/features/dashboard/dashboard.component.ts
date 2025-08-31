import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth/auth.service';
import { LoanService } from '../../core/services/loan/loan.service';
import { TransactionService } from '../../core/services/transactions/transaction.service';
import { AccountService } from '../../core/services/accounts/account.service';
import { Transaction, UserProfile } from '../../shared/models/dashboard.model';
import { Loan, LoanStats } from '../../shared/models/loan.model';
import { NgChartsModule } from 'ng2-charts';
import { ChartConfiguration, ChartType } from 'chart.js';
import { FormsModule } from '@angular/forms';
import { CurrencyXofPipe } from '../../shared/pipe/currency-xof.pipe';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, NgChartsModule, FormsModule, CurrencyXofPipe],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  userData: UserProfile | null = null;
  accountBalance = 0;

  loanStats: LoanStats | null = null;

  recentTransactions: Transaction[] = [];
  upcomingInstallments: any[] = [];
  installmentsDueSoon: any[] = [];

  showModal = false;
  isPaying = false;

  showPasswordModal = false;
  enteredPassword = '';
  verifying = false;
  passwordError = '';

  paymentAmount = 0;
  paymentMethod = 'wallet'; // ou mobile_money, carte, etc.

  distributionData: ChartConfiguration<'doughnut'>['data'] = {
    labels: [],
    datasets: [{
      data: [],
      backgroundColor: [],
      borderWidth: 1
    }]
  };
  distributionType: ChartType = 'doughnut';

  monthlyPaymentsData: ChartConfiguration<'bar'>['data'] = {
    labels: [],
    datasets: [{
      label: 'Paiements mensuels',
      data: [],
      backgroundColor: [],
      borderColor: '#00000022',
      borderWidth: 1
    }]
  };
  monthlyPaymentsType: ChartType = 'bar';

  chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    plugins: {
      legend: { display: true }
    }
  };

  doughnutChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#343a40', font: { size: 14, weight: 'bold' } }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const value = context.raw || 0;
            return `${label} : ${value} prêts`;
          }
        }
      }
    }
  };

  barChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    scales: {
      x: { ticks: { color: '#495057' } },
      y: {
        beginAtZero: true,
        ticks: {
          color: '#495057',
          callback: (tickValue: string | number) => {
            const value = typeof tickValue === 'number' ? tickValue : parseFloat(tickValue);
            return `${value} FCFA`;
          }
        }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (context) => `${context.parsed.y} FCFA` } }
    }
  };

  get creditScore(): number {
    return this.loanStats?.creditScore ?? 0;
  }

  getCreditScoreColor(score: number): string {
    if (score >= 80) return 'bg-success';
    if (score >= 50) return 'bg-warning';
    return 'bg-danger';
  }

  constructor(
    private authService: AuthService,
    private loanService: LoanService,
    private transactionService: TransactionService,
    private accountService: AccountService,
    private router: Router
  ) { }

  ngOnInit() {
    this.loadUserData();
    this.loadLoanStats();
    this.loadRecentTransactions();
    this.loadUpcomingInstallments();
    this.loadAccountBalance();
    this.loadDashboardData();
  }

  loadUserData() {
    this.authService.getUserProfile().subscribe({
      next: (data) => this.userData = data,
      error: (err) => console.error('Erreur profil utilisateur', err)
    });
  }

  loadAccountBalance() {
    this.accountService.getAccountBalance().subscribe({
      next: res => this.accountBalance = res.balance,
      error: err => console.error('Erreur chargement solde:', err)
    });
  }

  loadLoanStats() {
    this.loanService.getLoanStatistics().subscribe({
      next: (stats) => {
        console.log('✅ Stats:', stats);
        this.loanStats = stats;
      },
      error: (err) => console.error('Erreur stats depuis vue SQL', err)
    });
  }

  isSoon(dateString: string | null): boolean {
    if (!dateString) return false;

    const now = new Date();
    const targetDate = new Date(dateString);
    const diffInDays = (targetDate.getTime() - now.getTime()) / (1000 * 3600 * 24);

    return diffInDays <= 7;
  }

  loadUpcomingInstallments() {
    this.loanService.getUpcomingInstallments().subscribe({
      next: (data) => {
        this.upcomingInstallments = data;
        this.installmentsDueSoon = data.filter(i => this.isSoon(i.dueDate));
      },
      error: (err) => console.error('Erreur échéances à venir', err)
    });
  }

  loadRecentTransactions() {
    this.transactionService.getRecentTransactions().subscribe({
      next: (txs) => this.recentTransactions = txs,
      error: (err) => console.error('Erreur transactions récentes', err)
    });
  }

  private generateColors(count: number): string[] {
    const baseColors = [
      '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b',
      '#858796', '#5a5c69', '#20c997', '#6f42c1', '#fd7e14'
    ];
    const colors: string[] = [];

    for (let i = 0; i < count; i++) {
      if (i < baseColors.length) {
        colors.push(baseColors[i]);
      } else {
        const randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
        colors.push(randomColor);
      }
    }

    return colors;
  }

  loadDashboardData(): void {
    this.loanService.getLoanDistribution().subscribe({
      next: data => {
        const labels = ['Actifs', 'Terminés', 'En retard'];
        const values = [data.active, data.completed, data.overdue];
        const colors = this.generateColors(labels.length);

        this.distributionData = {
          labels,
          datasets: [{
            data: values,
            backgroundColor: colors,
            borderWidth: 1
          }]
        };
      },
      error: err => console.error('Erreur distribution:', err)
    });

    this.loanService.getMonthlyPaymentStats().subscribe({
      next: data => {
        const labels = data.map(d => `${d.month}/${d.year}`);
        const totals = data.map(d => d.total);
        const colors = this.generateColors(data.length);

        this.monthlyPaymentsData = {
          labels,
          datasets: [{
            label: 'Paiements mensuels',
            data: totals,
            backgroundColor: colors,
            borderColor: '#00000022',
            borderWidth: 1
          }]
        };
      },
      error: err => console.error('Erreur paiements mensuels:', err)
    });
  }

  getTransactionIcon(type: string): string {
    switch (type) {
      case 'deposit': return 'bi bi-arrow-down-circle text-success';
      case 'withdrawal': return 'bi bi-arrow-up-circle text-danger';
      case 'payment': return 'bi bi-credit-card text-warning';
      case 'loan': return 'bi bi-cash-stack text-primary';
      default: return 'bi bi-question-circle';
    }
  }

  viewLoanDetails() {
    this.loanService.getUserLoans().subscribe({
      next: (loans: Loan[]) => {
        const activeLoans = loans.filter((l: Loan) =>
          ['approved', 'active', 'pending'].includes(l.status)
        );

        if (activeLoans.length === 1) {
          this.router.navigate(['/loans', activeLoans[0].id]);
        } else {
          this.router.navigate(['/loans']);
        }
      },
      error: (err: any) => {
        console.error('Erreur chargement prêts utilisateur', err);
      }
    });
  }

  openPaymentModal(): void {
    this.paymentAmount = this.loanStats?.next_payment_amount ?? 0;
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
  }

  confirmPayment(): void {
    if (!this.loanStats?.current_loan_id) return;

    this.isPaying = true;

    this.loanService.repayLoan({
      loanId: this.loanStats.current_loan_id,
      amount: this.paymentAmount,
      method: this.paymentMethod
    }).subscribe({
      next: () => {
        alert("✅ Paiement effectué avec succès !");
        this.showModal = false;
        this.isPaying = false;
        this.loadLoanStats();
        this.loadAccountBalance();
        this.loadUpcomingInstallments();
        this.loadRecentTransactions();
      },
      error: (err) => {
        console.error('Erreur paiement:', err);
        // -> Amélioration : si l'erreur contient "paiement traité", informer l'utilisateur
        if (err.error && err.error.message?.includes("paiement")) {
          alert("⚠️ Paiement traité mais une erreur est survenue.");
        } else {
          alert("❌ Erreur lors du paiement.");
        }
        this.isPaying = false;
      }
    });
  }

  openPasswordModal() {
    this.enteredPassword = '';
    this.passwordError = '';
    this.showPasswordModal = true;
  }

  closePasswordModal() {
    this.showPasswordModal = false;
  }

  verifyPasswordAndViewRIB() {
    if (!this.enteredPassword) {
      this.passwordError = "Veuillez entrer votre mot de passe.";
      return;
    }

    this.verifying = true;
    this.passwordError = '';

  this.accountService.verifyPassword(this.enteredPassword).subscribe({
    next: (res) => {
      this.verifying = false;
      if (res.success) {
        this.showPasswordModal = false;
        this.router.navigate(['/rib']);
      } else {
        this.passwordError = "Mot de passe incorrect.";
      }
    },
    error: (err) => {
      this.verifying = false;
      console.error('Erreur API', err);
      this.passwordError = "Erreur serveur. Veuillez réessayer.";
    }
    });
  }

}
