import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { LoanService } from '../../../core/services/loan/loan.service';
import { LoanProduct } from '../../../shared/models/loan.model';

@Component({
  selector: 'app-formulaire-pret',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './formulaire-pret.component.html',
  styleUrl: './formulaire-pret.component.scss'
})
export class FormulairePretComponent implements OnInit {
  form!: FormGroup;
  productId!: string;
  selectedProduct!: LoanProduct;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private loanService: LoanService
  ) {}

  ngOnInit() {
    this.productId = this.route.snapshot.paramMap.get('id')!;

    this.loanService.getLoanProductById(this.productId).subscribe({
      next: (product) => {
        this.selectedProduct = product;

        console.log('Produit récupéré :', product); // ← ici
        console.log('Taux d\'intérêt :', product.interestRate); // ← ici


        this.form = this.fb.group({
          fullName: ['', Validators.required],
          email: ['', [Validators.required, Validators.email]],
          amount: [product.minAmount, Validators.required],
          termMonths: [product.minTerm, Validators.required],
          interestRate: [product.interestRate, Validators.required],
          purpose: [''],
          disburseImmediately: [true]
        });
      },
      error: (err) => {
        console.error('Erreur chargement produit:', err);
      }
    });
  }

  onSubmit() {
    if (this.form.valid) {
      const payload = {
        ...this.form.value,
        productId: this.productId
      };

      this.loanService.applyForLoan(payload).subscribe({
        next: () => {
          alert('✅ Votre demande a été soumise avec succès !');
          this.form.reset();
        },
        error: (err) => {
          console.error('Erreur soumission prêt:', err);
          alert("❌ Une erreur s'est produite. Veuillez réessayer.");
        }
      });
    }
  }
}
