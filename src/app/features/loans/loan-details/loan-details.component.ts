import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LoanService } from '../../../core/services/loan/loan.service';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Installment } from '../../../shared/models/loan.model';
import { CurrencyXofPipe } from '../../../shared/pipe/currency-xof.pipe';

@Component({
  selector: 'app-loan-details',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CurrencyXofPipe],
  templateUrl: './loan-details.component.html',
  styleUrl: './loan-details.component.scss'
})
export class LoanDetailsComponent implements OnInit {
  loan: any;
  loading = true;
  error = '';
  paymentForm!: FormGroup;
  paymentSuccess = '';
  paymentError = '';
  isSubmitting = false;

  constructor(
    private route: ActivatedRoute,
    private loanService: LoanService,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    const loanId = this.route.snapshot.paramMap.get('id');
    if (!loanId) {
      this.error = 'Identifiant de prêt invalide.';
      this.loading = false;
      return;
    }

    this.loadLoan(loanId);
  }

  private loadLoan(loanId: string) {
    this.loanService.getLoanDetails(loanId).subscribe({
      next: (res) => {
        this.loan = res;
        this.loading = false;
        this.initializeForm();
      },
      error: () => {
        this.error = 'Erreur lors du chargement des détails du prêt.';
        this.loading = false;
      }
    });
  }

  initializeForm() {
    // Trouver la prochaine échéance "upcoming"
    const nextPayment: Installment | undefined = this.loan.installments?.find(
      (i: Installment) => i.status === 'upcoming'
    );

    // Montant à payer : montant de la prochaine échéance ou 0 si aucune
    const nextPaymentAmount = nextPayment?.amount ?? 0;

    this.paymentForm = this.fb.group({
      amount: [nextPaymentAmount, [Validators.required, Validators.min(1000)]],
      method: ['internal', Validators.required],
      phone: [''],
      cardNumber: [''],
      cardExpiry: [''],
      cardCvc: ['']
    });
  }


  repayLoan() {
    if (this.paymentForm.invalid || this.isSubmitting) return;

    this.isSubmitting = true;
    this.paymentSuccess = '';
    this.paymentError = '';

    // Récupération sécurisée du montant depuis le formControl désactivé
    const amount = this.paymentForm.get('amount')?.value;

    const payload = {
      loanId: this.loan.id,
      amount, // montant pris uniquement depuis le formControl désactivé
      method: this.paymentForm.value.method,
      phone: this.paymentForm.value.phone,
      cardNumber: this.paymentForm.value.cardNumber,
      cardExpiry: this.paymentForm.value.cardExpiry,
      cardCvc: this.paymentForm.value.cardCvc
    };

    this.loanService.repayLoan(payload).subscribe({
      next: () => {
        this.paymentSuccess = 'Paiement effectué avec succès.';
        this.refreshLoan();
      },
      error: (err: any) => {
        this.paymentError = err?.error?.message || 'Erreur pendant le paiement.';
        this.isSubmitting = false;
      }
    });
  }

  refreshLoan() {
    this.loanService.getLoanDetails(this.loan.id).subscribe({
      next: (res) => {
        this.loan = res;

        const nextPayment: Installment | undefined = this.loan.installments?.find(
          (i: Installment) => i.status === 'upcoming'
        );

        const nextPaymentAmount = nextPayment?.amount ?? 0;

        // Mettre à jour le champ montant avec la prochaine échéance
        this.paymentForm.get('amount')?.setValue(nextPaymentAmount);

        this.isSubmitting = false;
      },
      error: () => {
        this.isSubmitting = false;
      }
    });
  }

}
