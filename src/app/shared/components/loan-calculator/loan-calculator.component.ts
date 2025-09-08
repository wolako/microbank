import { Component, EventEmitter, Input, OnInit, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { LoanProduct } from '../../models/loan.model';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-loan-calculator',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './loan-calculator.component.html',
  styleUrls: ['./loan-calculator.component.scss']
})
export class LoanCalculatorComponent implements OnInit, OnChanges {
  @Input() loanProduct: LoanProduct | null = null;
  @Output() calculate = new EventEmitter<any>();

  loanForm: FormGroup;
  monthlyPayment: number | null = null;
  totalInterest: number | null = null;
  totalPayment: number | null = null;
  showResults = false;

  constructor(private fb: FormBuilder, private http: HttpClient) {
    this.loanForm = this.fb.group({
      amount: [10000, [Validators.required, Validators.min(1000)]],
      term: [12, [Validators.required, Validators.min(1), Validators.max(600)]],
      rate: [0, [Validators.required, Validators.min(0)]]
    });
  }

  ngOnInit(): void {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['loanProduct'] && this.loanProduct) {
      const r = this.loanProduct.interestRate ?? 0;
      this.loanForm.patchValue({ rate: r }, { emitEvent: false });
    }
  }

  calculateLoan() {
    if (this.loanForm.invalid) {
      this.loanForm.markAllAsTouched();
      return;
    }

    const amount = Number(this.loanForm.value.amount);
    const term = Number(this.loanForm.value.term);
    const rate = Number(this.loanForm.value.rate ?? this.loanProduct?.interestRate ?? 0);

    this.http.post<any>(`${environment.apiUrl}/loans/simulate`, {
      amount,
      term,
      rate
    }).subscribe({
      next: (result) => {
        this.monthlyPayment = result.monthlyPayment;
        this.totalPayment = result.totalPayment;
        this.totalInterest = result.totalInterest;
        this.showResults = true;
        this.calculate.emit(result);
      },
      error: (err) => {
        console.error('❌ Erreur API simulate:', err);
      }
    });
  }

  // Getters min/max
  get minAmount(): number { return this.loanProduct?.minAmount ?? 1000; }
  get maxAmount(): number { return this.loanProduct?.maxAmount ?? 500000; }
  get minTerm(): number { return this.loanProduct?.minTerm ?? 1; }
  get maxTerm(): number { return this.loanProduct?.maxTerm ?? 360; }
}
