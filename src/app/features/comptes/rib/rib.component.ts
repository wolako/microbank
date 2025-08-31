import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { jsPDF } from 'jspdf';
import { CurrencyXofPipe } from '../../../shared/pipe/currency-xof.pipe';


@Component({
  selector: 'app-rib',
  standalone: true,
  imports: [CommonModule, CurrencyXofPipe],
  templateUrl: './rib.component.html',
  styleUrl: './rib.component.scss'
})
export class RibComponent implements OnInit {
  accountData: any;
  loading = false;
  error = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loading = true;
    this.http.get(`${environment.apiUrl}/accounts/me`).subscribe({
      next: (data) => {
        this.accountData = data;
        this.loading = false;
      },
      error: () => {
        this.error = "Impossible de charger les informations du compte.";
        this.loading = false;
      }
    });
  }

  copyToClipboard() {
    navigator.clipboard.writeText(this.accountData.accountnumber);
    alert('Numéro de compte copié ✅');
  }

  downloadPDF() {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Relevé d’Identité Bancaire (RIB)', 20, 20);
    doc.setFontSize(12);
    doc.text(`Nom : ${this.accountData.firstName} ${this.accountData.lastName}`, 20, 40);
    doc.text(`Email : ${this.accountData.email}`, 20, 50);
    doc.text(`Numéro de compte : ${this.accountData.accountnumber}`, 20, 60);

    // Formater le solde pour le PDF
    const balance = Math.floor(this.accountData.balance);
    const balanceFormatted = balance.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    
    doc.text(`Solde actuel : ${balanceFormatted} F CFA`, 20, 70);
    doc.save('rib.pdf');
  }


  sendRibByEmail() {
    const formattedBalance = new CurrencyXofPipe().transform(this.accountData.balance);
    const subject = encodeURIComponent('Voici mon RIB');
    const body = encodeURIComponent(
      `Bonjour,\n\nVoici mes coordonnées bancaires :\n\n` +
      `Nom : ${this.accountData.firstname} ${this.accountData.lastname}\n` +
      `Email : ${this.accountData.email}\n` +
      `RIB : ${this.accountData.accountnumber}\n` +
      `Solde : ${formattedBalance}\n\n` +
      `Merci de les conserver en sécurité.`
    );

    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  }
}
