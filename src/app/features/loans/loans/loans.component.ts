// loans.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { LoanService } from '../../../core/services/loan/loan.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { LoanProduct } from '../../../shared/models/loan.model';
import { LoanCalculatorComponent } from '../../../shared/components/loan-calculator/loan-calculator.component';
import { TwoFaModalComponent } from '../../../shared/components/two-fa-modal/two-fa-modal.component';

@Component({
  selector: 'app-loans',
  standalone: true,
  imports: [CommonModule, RouterLink, LoanCalculatorComponent, TwoFaModalComponent],
  templateUrl: './loans.component.html',
  styleUrls: ['./loans.component.scss']
})
export class LoansComponent implements OnInit {
  loanProducts: LoanProduct[] = [];
  selectedProduct: LoanProduct | null = null;

  show2FAModal = false;
  productToApply: LoanProduct | null = null;

  constructor(
    private loanService: LoanService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadLoanProducts();
  }

  loadLoanProducts() {
    this.loanService.getLoanProducts().subscribe({
      next: (products) => {
        this.loanProducts = products;
      },
      error: (err) => console.error('Erreur lors du chargement des produits de prêt :', err)
    });
  }

  getProductIcon(type: string): string {
    switch (type) {
      case 'personal': return 'bi bi-person';
      case 'mortgage': return 'bi bi-house';
      case 'business': return 'bi bi-briefcase';
      default: return 'bi bi-cash';
    }
  }

  selectProduct(product: LoanProduct) {
    this.selectedProduct = product;
  }

  // -------------------------
  // Demande de prêt avec 2FA
  // -------------------------
  requestLoan(product: LoanProduct) {
    if (this.authService.is2FAValid()) {
      this.goToForm(product);
    } else {
      this.productToApply = product;
      this.show2FAModal = true;
    }
  }

  submit2FAToken(token: string) {
    const currentUser = this.authService.currentUserValue;
    if (!currentUser) return;

    this.authService.validate2FAToken(currentUser.id, token).subscribe({
      next: () => {
        this.show2FAModal = false;
        if (this.productToApply) {
          this.goToForm(this.productToApply);
          this.productToApply = null;
        }
      },
      error: () => {
        alert('Code 2FA invalide, veuillez réessayer.');
      }
    });
  }

  goToForm(product: LoanProduct) {
    this.router.navigate(['/loans/apply', product.id]);
  }
}
