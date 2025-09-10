import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { first } from 'rxjs/operators';

import { LoanService } from '../../../core/services/loan/loan.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { LoanProduct } from '../../../shared/models/loan.model';

@Component({
  selector: 'app-loan-apply',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './loan-apply.component.html',
  styleUrls: ['./loan-apply.component.scss']
})
export class LoanApplyComponent {
  form!: FormGroup;
  product!: LoanProduct | null;
  loading = false;
  error = '';
  success = '';
  currentUser: any;

  fieldErrors = {
    fullName: '',
    email: '',
    phone: ''
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private loanService: LoanService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadCurrentUserAndProduct();
  }

  private loadCurrentUserAndProduct() {
    this.authService.ensureUserLoaded().pipe(first()).subscribe(user => {
      if (!user) {
        this.error = 'Utilisateur non connecté.';
        return;
      }
      this.currentUser = user;

      const productId = this.route.snapshot.paramMap.get('id');
      if (!productId) {
        this.error = 'Produit de prêt introuvable';
        return;
      }

      this.loanService.getLoanProductById(productId).subscribe({
        next: (product) => {
          this.product = product;
          this.initializeForm();
        },
        error: (err) => {
          console.error(err);
          this.error = 'Produit introuvable';
        }
      });
    });
  }

  private initializeForm() {
    if (!this.product) return;

    this.form = this.fb.group({
      fullName: ['', [Validators.required, Validators.pattern(/^[a-zA-Z]+(\s[a-zA-Z]+)+$/)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^\d{8,15}$/)]],
      amount: [null, [Validators.required, Validators.min(this.product.minAmount)]],
      term: [null, [Validators.required, Validators.min(this.product.minTerm)]],
      interestRate: [this.product.interestRate, Validators.required],
      reason: ['']
    });

    this.setupFieldValidations();
  }

  private setupFieldValidations() {
    this.form.get('fullName')?.valueChanges.subscribe(value => {
      if (value.trim().length === 0) {
        this.fieldErrors.fullName = 'Le nom complet est requis.';
      } else if (!/^[a-zA-Z]+(\s[a-zA-Z]+)+$/.test(value)) {
        this.fieldErrors.fullName = 'Entrez au moins deux mots avec des lettres uniquement.';
      } else {
        this.fieldErrors.fullName = '';
      }
    });

    this.form.get('email')?.valueChanges.subscribe(value => {
      if (value.trim().length === 0) {
        this.fieldErrors.email = 'L’email est requis.';
      } else if (this.form.get('email')?.hasError('email')) {
        this.fieldErrors.email = 'Format d’email invalide.';
      } else {
        this.fieldErrors.email = '';
      }
    });

    this.form.get('phone')?.valueChanges.subscribe(value => {
      if (value.trim().length === 0) {
        this.fieldErrors.phone = 'Le téléphone est requis.';
      } else if (!/^\d{8,15}$/.test(value)) {
        this.fieldErrors.phone = 'Numéro de téléphone invalide (8 à 15 chiffres).';
      } else {
        this.fieldErrors.phone = '';
      }
    });
  }

  onSubmit(): void {
    if (!this.form.valid || !this.product) return;

    if (this.fieldErrors.fullName || this.fieldErrors.email || this.fieldErrors.phone) {
      this.error = 'Corrigez les erreurs dans les champs avant de soumettre.';
      return;
    }

    this.loading = true;
    this.error = '';
    this.success = '';

    const formData = {
      productId: this.product.id,
      fullName: this.form.value.fullName,
      email: this.form.value.email,
      phone: this.form.value.phone,
      amount: this.form.value.amount,
      term: this.form.value.term,
      interestRate: this.form.value.interestRate,
      reason: this.form.value.reason
    };

    this.loanService.applyForLoan(formData).subscribe({
      next: () => {
        this.loading = false;
        this.success = '✅ Votre demande a été envoyée avec succès.';
        // attendre 3 secondes avant redirection
        setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 3000);
      },
      error: (err) => {
        console.error('Erreur demande prêt:', err);
        this.error = '❌ Erreur lors de la soumission de la demande.';
        this.loading = false;
      }
    });
  }
}
