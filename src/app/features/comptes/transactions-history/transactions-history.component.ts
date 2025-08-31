import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TransactionService } from '../../../core/services/transactions/transaction.service';
import { Transaction } from '../../../shared/models/dashboard.model';

import { Chart, registerables } from 'chart.js';
import { CurrencyXofPipe } from '../../../shared/pipe/currency-xof.pipe';
Chart.register(...registerables);

@Component({
  selector: 'app-transactions-history',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CurrencyXofPipe],
  templateUrl: './transactions-history.component.html',
  styleUrl: './transactions-history.component.scss'
})
export class TransactionsHistoryComponent implements OnInit, AfterViewInit {
  transactions: Transaction[] = [];
  filteredTransactions: Transaction[] = [];
  filterType: string = '';
  filterChannel: string = '';
  availableChannels: string[] = [];
  isLoading = true;
  errorMessage = '';

  currentPage: number = 1;
  itemsPerPage: number = 5;

  monthlyChartData: { labels: string[]; totals: number[] } = { labels: [], totals: [] };

  constructor(private transactionService: TransactionService) {}

  ngOnInit(): void {
    this.loadTransactions();
  }

  ngAfterViewInit(): void {
    // Chart sera dessiné après les données
    setTimeout(() => this.renderChart(), 500);
  }

  loadTransactions(): void {
    this.transactionService.getAllTransactions().subscribe({
      next: (data) => {
        this.transactions = data.map(tx => ({
          ...tx,
          channel: tx.channel ?? tx.metadata?.['paymentMethod'] ?? undefined
        }));

        this.extractAvailableChannels();
        this.applyFilter();
        this.prepareMonthlyChart();
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Erreur lors du chargement des transactions';
        this.isLoading = false;
      }
    });
  }

  extractAvailableChannels(): void {
    const channelsSet = new Set<string>();

    this.transactions.forEach(tx => {
      if (tx.channel && tx.channel.trim() !== '') {
        channelsSet.add(tx.channel.trim());
      } else if (tx.metadata?.['paymentMethod'] && tx.metadata['paymentMethod'].trim() !== '') {
        channelsSet.add(tx.metadata['paymentMethod'].trim());
      }
    });

    this.availableChannels = Array.from(channelsSet).sort((a, b) => a.localeCompare(b));
  }

  applyFilter(): void {
    this.filteredTransactions = this.transactions.filter(tx =>
      (!this.filterType || tx.type === this.filterType) &&
      (!this.filterChannel || tx.channel === this.filterChannel)
    );
    this.currentPage = 1;
  }

  paginatedTransactions(): Transaction[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredTransactions.slice(start, start + this.itemsPerPage);
  }

  totalPages(): number[] {
    const total = Math.ceil(this.filteredTransactions.length / this.itemsPerPage);
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages().length) {
      this.currentPage = page;
    }
  }

  printReceipt(tx: any) {
    const popup = window.open('', '_blank', 'width=600,height=800');
    const content = `
      <html>
        <head>
          <title>Reçu de transaction</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h2 { text-align: center; }
            ul { list-style: none; padding: 0; }
            li { margin: 8px 0; }
            .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #888; }
          </style>
        </head>
        <body>
          <h2>🧾 Reçu de transaction</h2>
          <ul>
            <li><strong>Type :</strong> ${tx.type}</li>
            <li><strong>Montant :</strong> ${tx.amount} XOF</li>
            <li><strong>Description :</strong> ${tx.description || '-'}</li>
            <li><strong>Canal :</strong> ${tx.channel || '-'}</li>
            <li><strong>Date :</strong> ${new Date(tx.created_at).toLocaleString('fr-FR')}</li>
            <li><strong>Solde après transaction :</strong> ${tx.balance_after} XOF</li>
            <li><strong>ID de transaction :</strong> ${tx.id}</li>
          </ul>
          <div class="footer">Microbank - Reçu généré le ${new Date().toLocaleDateString()}</div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); }
            }
          </script>
        </body>
      </html>
    `;
    popup?.document.write(content);
    popup?.document.close();
  }

  getIcon(type: string): string {
    switch (type) {
      case 'deposit_manual':
      case 'deposit_wire':
      case 'deposit_mobile':
      case 'deposit_card':
        return 'bi bi-arrow-down-circle text-success';
      case 'withdrawal_mobile':
      case 'withdrawal_card':
      case 'withdrawal_atm':
        return 'bi bi-arrow-up-circle text-danger';
      case 'transfer':
        return 'bi bi-arrow-left-right text-warning';
      case 'wire':
        return 'bi bi-bank text-primary';
      case 'bill_payment':
        return 'bi bi-receipt text-info'; 
      case 'purchase':
        return 'bi bi-bag-check text-warning';
      default:
        return 'bi bi-question-circle';
    }
  }

  prepareMonthlyChart(): void {
    const map = new Map<string, number>();

    this.transactions.forEach(tx => {
      const date = new Date(tx.created_at);
      const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      map.set(key, (map.get(key) || 0) + tx.amount);
    });

    const sorted = Array.from(map.entries()).sort();
    this.monthlyChartData = {
      labels: sorted.map(([k]) => {
        const [y, m] = k.split('-');
        return new Date(+y, +m - 1).toLocaleString('fr-FR', { month: 'short', year: 'numeric' });
      }),
      totals: sorted.map(([_, v]) => v)
    };
  }

  renderChart(): void {
    const canvas = document.getElementById('monthlyChart') as HTMLCanvasElement;
    if (!canvas) return;

    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: this.monthlyChartData.labels,
        datasets: [{
          label: 'Transactions mensuelles (XOF)',
          data: this.monthlyChartData.totals,
          backgroundColor: '#007bff'
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }

  // Ajout optionnel pour afficher un label plus lisible pour les types
  formatType(type: string): string {
    const map: { [key: string]: string } = {
      deposit_manual: 'Dépôt manuel',
      deposit_mobile: 'Dépôt Mobile Money',
      deposit_card: 'Dépôt Carte bancaire',
      deposit_wire: 'Dépôt virement',
      withdrawal_mobile: 'Retrait Mobile Money',
      withdrawal_card: 'Retrait Carte bancaire',
      withdrawal_atm: 'Retrait Guichet automatique',
      transfer: 'Transfert',
      wire: 'Virement',
      bill_payment: 'Paiement facture',
      purchase: 'Achat en ligne'
    };
    return map[type] ?? type;
  }
}
