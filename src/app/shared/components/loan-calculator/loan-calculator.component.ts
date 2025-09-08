import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { LoanProduct } from '../../models/loan.model';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-loan-calculator',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './loan-calculator.component.html',
  styleUrls: ['./loan-calculator.component.scss'],
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ transform: 'translateX(100%)', opacity: 0 }),
        animate('500ms ease-out', style({ transform: 'translateX(0)', opacity: 1 }))
      ])
    ])
  ]
})
export class LoanCalculatorComponent implements OnInit {
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
      term: [12, [Validators.required, Validators.min(3), Validators.max(60)]]
    });
  }

  ngOnInit(): void {
    // si product fourni, ajuster min/max via template getters
    // recalculer à chaque changement de valeur (debounce si besoin)
    this.loanForm.valueChanges.subscribe(() => {
      // ne recalculer que si déjà visible ou si tu veux auto-calc
      // ici on ne calcule pas automatiquement pour éviter trop d'appels réseau
    });
  }

  calculateLoan() {
    if (!this.loanProduct) return;
    if (this.loanForm.invalid) {
      // optionnel : afficher erreurs
      return;
    }

    const amount = this.loanForm.get('amount')!.value;
    const term = this.loanForm.get('term')!.value;
    const rate = this.loanProduct.interestRate;

    this.http.post<any>(`${environment.apiUrl}/loans/simulate`, {
      amount,
      term,
      rate
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
        // tu peux afficher un toast/message utilisateur ici
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
}
