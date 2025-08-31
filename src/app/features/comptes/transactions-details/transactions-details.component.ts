import { Component, inject, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { TransactionService } from '../../../core/services/transactions/transaction.service';
import { ActivatedRoute } from '@angular/router';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

@Component({
  selector: 'app-transactions-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './transactions-details.component.html',
  styleUrl: './transactions-details.component.scss'
})
export class TransactionsDetailsComponent implements OnInit {
  private location = inject(Location);
  private route = inject(ActivatedRoute);
  transaction: any = null;
  isLoading = true;
  errorMessage = '';

  constructor(private transactionService: TransactionService) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.transactionService.getTransactionById(id).subscribe({
        next: tx => {
          this.transaction = tx;
          this.isLoading = false;
        },
        error: () => {
          this.errorMessage = 'Transaction introuvable';
          this.isLoading = false;
        }
      });
    }
  }

  goBack() {
    this.location.back();
  }

  printReceipt() {
    const tx = this.transaction;
    const isBill = tx?.type === 'facture' || tx?.type === 'Paiement de facture';
    const isPurchase = tx?.type === 'purchase';

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
            <li><strong>ID :</strong> ${tx?.id}</li>
            <li><strong>Type :</strong> ${tx?.type}</li>
            <li><strong>Montant :</strong> ${tx?.amount} XOF</li>
            <li><strong>Description :</strong> ${tx?.description || '—'}</li>
            <li><strong>Date :</strong> ${new Date(tx?.created_at).toLocaleString()}</li>
            <li><strong>Solde après transaction :</strong> ${tx?.balanceAfter ?? '—'} XOF</li>
            <li><strong>Canal :</strong> ${tx?.channel || '—'}</li>
            ${isBill && tx?.billerName ? `<li><strong>Facturier :</strong> ${tx.billerName}</li>` : ''}
            ${isBill && tx?.service ? `<li><strong>Service :</strong> ${tx.service}</li>` : ''}
            ${isBill && tx?.clientNumber ? `<li><strong>Numéro client :</strong> ${tx.clientNumber}</li>` : ''}
            ${isBill && tx?.period ? `<li><strong>Période :</strong> ${tx.period}</li>` : ''}
            ${isBill && tx?.reference ? `<li><strong>Référence :</strong> ${tx.reference}</li>` : ''}
            ${isPurchase && tx?.merchant ? `<li><strong>Marchand :</strong> ${tx.merchant}</li>` : ''}
            ${isPurchase && tx?.product ? `<li><strong>Produit :</strong> ${tx.product}</li>` : ''}
            ${isPurchase && tx?.orderRef ? `<li><strong>Référence commande :</strong> ${tx.orderRef}</li>` : ''}
          </ul>
          <div class="footer">
            Microbank - Reçu généré le ${new Date().toLocaleDateString()}
          </div>
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

  downloadPDF() {
    const doc = new jsPDF();
    const tx = this.transaction;
    const isBill = tx?.type === 'facture' || tx?.type === 'Paiement de facture';
    const isPurchase = tx?.type === 'purchase';

    doc.setFontSize(18);
    doc.text('🧾 Reçu de Transaction', 14, 20);

    const body: any[][] = [
      ['ID', tx?.id],
      ['Type', tx?.type],
      ['Montant', `${tx?.amount} XOF`],
      ['Description', tx?.description || '—'],
      ['Date', new Date(tx?.created_at).toLocaleString()],
      ['Solde après transaction', `${tx?.balance_after ?? '—'} XOF`],
      ['Canal', tx?.channel || '—']
    ];

    if (isBill) {
      if (tx?.billerName) body.push(['Facturier', tx.billerName]);
      if (tx?.service) body.push(['Service', tx.service]);
      if (tx?.clientNumber) body.push(['Numéro client', tx.clientNumber]);
      if (tx?.period) body.push(['Période', tx.period]);
      if (tx?.reference) body.push(['Référence', tx.reference]);
    }

    if (isPurchase) {
      if (tx?.merchant) body.push(['Marchand', tx.merchant]);
      if (tx?.product) body.push(['Produit', tx.product]);
      if (tx?.orderRef) body.push(['Référence commande', tx.orderRef]);
    }

    autoTable(doc, {
      startY: 30,
      theme: 'grid',
      head: [['Champ', 'Valeur']],
      body
    });

    doc.setFontSize(10);
    doc.text(`Microbank - Reçu généré le ${new Date().toLocaleDateString()}`, 14, doc.internal.pageSize.height - 10);
    doc.save(`recu-transaction-${tx?.id}.pdf`);
  }
}
