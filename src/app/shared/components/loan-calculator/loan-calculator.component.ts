import { Component, EventEmitter, Input, Output } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { LoanProduct } from '../../models/loan.model';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-loan-calculator',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './loan-calculator.component.html',
  styleUrl: './loan-calculator.component.scss',
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ transform: 'translateX(100%)', opacity: 0 }),
        animate('500ms ease-out', style({ transform: 'translateX(0)', opacity: 1 }))
      ])
    ])
  ]
})
export class LoanCalculatorComponent {
  @Input() loanProduct: LoanProduct | null = null;
  @Output() calculate = new EventEmitter<any>();

  amount: number = 10000;
  term: number = 12;
  monthlyPayment: number | null = null;
  totalInterest: number | null = null;
  totalPayment: number | null = null;
  showResults = false;
  loanForm: FormGroup;

   constructor(private fb: FormBuilder, private http: HttpClient) {
    this.loanForm = this.fb.group({
      amount: [10000, [Validators.required, Validators.min(1000)]],
      term: [12, [Validators.required, Validators.min(3), Validators.max(60)]],
      rate: [8.5, [Validators.required, Validators.min(1), Validators.max(30)]]
    });
  }

  calculateLoan() {
    if (!this.loanProduct) return;

    this.http.post<any>(`${environment.apiUrl}/loans/simulate`, {
      amount: this.amount,
      term: this.term,
      rate: this.loanProduct.interestRate
    }).subscribe({
      next: (result) => {
        this.monthlyPayment = result.monthlyPayment;
        this.totalPayment = result.totalPayment;
        this.totalInterest = result.totalInterest;

        this.calculate.emit(result);
        this.showResults = true;
      },
      error: (err) => {
        console.error('❌ Erreur API simulate:', err);
      }
    });
  }

  get minAmount(): number {
    return this.loanProduct?.minAmount || 1000;
  }

  get maxAmount(): number {
    return this.loanProduct?.maxAmount || 50000;
  }

  get minTerm(): number {
    return this.loanProduct?.minTerm || 6;
  }

  get maxTerm(): number {
    return this.loanProduct?.maxTerm || 60;
  }

  // calculateLoan() {
  //   if (this.loanForm.valid) {
  //     const { amount, term, rate } = this.loanForm.value;
  //     const monthlyRate = rate / 100 / 12;
  //     const payments = term;
      
  //     this.monthlyPayment = (amount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -payments));
  //     this.totalPayment = this.monthlyPayment * payments;
  //     this.totalInterest = this.totalPayment - amount;
  //     this.showResults = true;
  //   }
  // }
}
