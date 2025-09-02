// import { Component, OnInit } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
// import { TransactionService } from '../../../core/services/transactions/transaction.service';
// import { AccountService } from '../../../core/services/accounts/account.service';
// import { AuthService } from '../../../core/services/auth/auth.service';
// import { take } from 'rxjs/operators';
// import { TwoFaModalComponent } from '../../../shared/components/two-fa-modal/two-fa-modal.component';
// import { FormsModule } from '@angular/forms';

// @Component({
//   selector: 'app-transactions',
//   standalone: true,
//   imports: [CommonModule, ReactiveFormsModule, FormsModule, TwoFaModalComponent],
//   templateUrl: './transactions.component.html',
//   styleUrls: ['./transactions.component.scss']
// })
// export class TransactionsComponent implements OnInit {
//   transactionsForm!: FormGroup;
//   isLoading = false;
//   successMessage = '';
//   errorMessage = '';
//   userBalance: number = 0;

//   // 2FA
//   show2FAModal = false;
//   pendingTransactionData: any;
//   currentUser: any;

//   showATMCodeInput: boolean = false;
//   pendingATMTransactionId: string | null = null;

//   constructor(
//     private fb: FormBuilder,
//     private transactionService: TransactionService,
//     private accountService: AccountService,
//     private authService: AuthService
//   ) {}

//   ngOnInit(): void {
//     this.transactionsForm = this.fb.group({
//       type: ['deposit_manual', Validators.required],
//       amount: [null, [Validators.required, Validators.min(1)]],
//       recipient: [''],
//       description: [''],
//       billType: ['CANAL'], // Valeur par défaut compatible backend
//       billReference: [''],
//       billProvider: [''],
//       merchant: [''],
//       product: [''],
//       orderRef: [''],
//       mobileMoneyPhone: [''],        
//       provider: ['T-MONEY']  
//     });

//     this.transactionsForm.get('type')?.valueChanges.subscribe(type => this.updateValidators(type));
//     this.transactionsForm.get('billType')?.valueChanges.subscribe(type => {
//       const currentProvider = this.transactionsForm.get('billProvider')?.value;
//       if (!currentProvider || currentProvider.trim() === '') {
//         this.transactionsForm.patchValue({ billProvider: type }, { emitEvent: false });
//       }
//     });

//     this.accountService.balance$.subscribe(balance => this.userBalance = balance);
//     this.accountService.refreshBalance();
//   }

//   private updateValidators(type: string) {
//     const recipientControl = this.transactionsForm.get('recipient');
//     const descriptionControl = this.transactionsForm.get('description');

//     if (type === 'transfer') recipientControl?.setValidators([Validators.required, Validators.pattern(/^\d{12,15}$/)]);
//     else if (type === 'wire') recipientControl?.setValidators([Validators.required, Validators.pattern(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/)]);
//     else recipientControl?.clearValidators();
//     recipientControl?.updateValueAndValidity();

//     const descriptions: Record<string, string> = {
//       deposit_manual: 'Dépôt manuel',
//       deposit_mobile: 'Dépôt via Mobile Money',
//       deposit_wire: 'Dépôt par virement',
//       deposit_card: 'Dépôt par carte bancaire',
//       withdrawal_mobile: 'Retrait via Mobile Money',
//       withdrawal_card: 'Retrait via carte bancaire',
//       withdrawal_atm: 'Retrait par guichet automatique',
//       transfer: 'Transfert interne',
//       wire: 'Virement externe',
//       bill_payment: 'Paiement de facture',
//       purchase: 'Achat en ligne'
//     };
//     if (!descriptionControl?.value || descriptionControl.value === descriptions[type]) {
//       descriptionControl?.setValue(descriptions[type] || '');
//     }
//   }

//   submit() {
//     if (this.transactionsForm.invalid) return;
//     this.isLoading = true;
//     this.successMessage = '';
//     this.errorMessage = '';
//     const type = this.transactionsForm.get('type')?.value;
//     const amount = this.transactionsForm.get('amount')?.value;
//     this.pendingTransactionData = { type, amount, form: this.transactionsForm.value };
//     this.show2FAModal = true;
//     this.isLoading = false;
//   }

//   submit2FAToken(token: string) {
//     if (!this.pendingTransactionData) return;
//     this.authService.ensureUserLoaded().pipe(take(1)).subscribe(user => {
//       if (!user || !user.id) {
//         this.errorMessage = '❌ Utilisateur non connecté';
//         this.show2FAModal = false;
//         return;
//       }
//       this.authService.validate2FAToken(user.id, token).subscribe({
//         next: response => {
//           if (response.success) {
//             this.show2FAModal = false;
//             this.executeTransaction(this.pendingTransactionData);
//           } else {
//             this.errorMessage = response.message || '❌ Code 2FA invalide';
//           }
//         },
//         error: err => this.errorMessage = err?.message || '❌ Erreur lors de la validation 2FA'
//       });
//     });
//   }

//   private executeTransaction(data: any) {
//     const { type, amount, form } = data;
//     let request$;

//     switch (type) {
//       case 'deposit_mobile':
//         if (!form.mobileMoneyPhone) { this.errorMessage = '📱 Numéro Mobile Money requis'; return; }
//         request$ = this.transactionService.createMobileMoneyDeposit(amount, form.mobileMoneyPhone, form.provider);
//         break;
//       case 'deposit_card':
//         if (!form.cardNumber || !form.cardExp || !form.cardCvv) { this.errorMessage = '💳 Infos de carte incomplètes'; return; }
//         request$ = this.transactionService.createCardDeposit(amount, { number: form.cardNumber, exp: form.cardExp, cvv: form.cardCvv });
//         break;
//       case 'deposit_wire':
//         if (!form.iban || !form.bankName) { this.errorMessage = '🏦 IBAN et nom de banque requis'; return; }
//         request$ = this.transactionService.createWireDeposit(amount, form.iban, form.bankName);
//         break;
//       case 'deposit_manual':
//         request$ = this.transactionService.createManualDeposit(amount);
//         break;
//       case 'bill_payment':
//         const billType = form.billType;           
//         const billProvider = (form.billProvider && form.billProvider.trim() !== '') ? form.billProvider.trim() : billType;
//         const reference = form.billReference || null;

//         if (!billType || !reference) {
//           this.errorMessage = '📄 Tous les champs de la facture sont obligatoires';
//           return;
//         }

//         request$ = this.transactionService.createBillPayment({
//           type: billType,
//           provider: billProvider,
//           amount,
//           reference
//         });
//         break;

//         case 'withdrawal_atm':
//           this.transactionService.createATMWithdrawal(amount).subscribe({
//             next: (res: any) => {
//               if (!res.atmWithdrawalId) {
//                 this.errorMessage = '❌ Impossible de générer le code ATM';
//                 return;
//               }
//               this.pendingATMTransactionId = res.atmWithdrawalId; // ID exact du backend
//               this.showATMCodeInput = true;
//               this.successMessage = '📩 Code ATM envoyé par SMS/email';
//               this.errorMessage = '';
//             },
//             error: (err: any) => {
//               this.errorMessage = err.error?.message || '❌ Erreur lors de la génération du code ATM';
//               this.successMessage = '';
//             }
//         });
//         break;

//       default:
//         request$ = this.transactionService.createTransaction({ type, amount, metadata: form });
//     }

//     request$?.subscribe({
//       next: (res: any) => {
//         if (res?.error?.includes('Solde insuffisant')) {
//           this.errorMessage = `❌ Solde insuffisant : ${res.error}`;
//           this.successMessage = '';
//           return;
//         }

//         this.successMessage = res?.message || '✅ Transaction réussie';
//         this.errorMessage = '';
//         this.transactionsForm.reset({ type: 'deposit_manual', billType: 'CANAL' });
//         this.accountService.refreshBalance();
//       },
//       error: (err: any) => {
//         this.errorMessage = err.error?.message || '❌ Erreur lors de la transaction';
//         this.successMessage = '';
//       }
//     });
//   }

//   get labelForRecipient(): string {
//     const type = this.transactionsForm.get('type')?.value;
//     if (type === 'transfer') return 'RIB du bénéficiaire (interne)';
//     if (type === 'wire') return 'IBAN du bénéficiaire (externe)';
//     return '';
//   }

//   submitATMCode(code: string) {
//     if (!this.pendingATMTransactionId) {
//       this.errorMessage = '❌ Aucun retrait ATM en attente';
//       return;
//     }

//     if (!code || code.trim().length === 0) {
//       this.errorMessage = '❌ Veuillez entrer le code ATM';
//       return;
//     }

//     this.transactionService.validateATMCode(this.pendingATMTransactionId, code.trim()).subscribe({
//       next: (res: any) => {
//         this.successMessage = res.message || '✅ Retrait ATM réussi';
//         this.errorMessage = '';
//         this.showATMCodeInput = false;
//         this.pendingATMTransactionId = null;
//         this.accountService.refreshBalance();

//         // Réinitialiser le formulaire avec les valeurs par défaut
//         this.transactionsForm.reset({
//           type: 'deposit_manual',
//           billType: 'CANAL',
//           provider: 'T-MONEY'
//         });
//       },
//       error: (err: any) => {
//         if (err.status === 404) {
//           this.errorMessage = '❌ Transaction introuvable ou déjà utilisée';
//         } else if (err.status === 400) {
//           this.errorMessage = err.error?.message || '❌ Code ATM invalide';
//         } else if (err.status === 403) {
//           this.errorMessage = err.error?.message || '❌ Nombre maximal de tentatives atteint';
//         } else {
//           this.errorMessage = '❌ Erreur lors de la validation du code ATM';
//         }
//         this.successMessage = '';
//       }
//     });
//   }

// }



import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { take } from 'rxjs/operators';

import { TransactionService } from '../../../core/services/transactions/transaction.service';
import { AccountService } from '../../../core/services/accounts/account.service';
import { AuthService } from '../../../core/services/auth/auth.service';

import { TwoFaModalComponent } from '../../../shared/components/two-fa-modal/two-fa-modal.component';
import { AtmCodeModalComponent } from '../../../shared/components/atm-code-modal/atm-code-modal.component';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, TwoFaModalComponent, AtmCodeModalComponent],
  templateUrl: './transactions.component.html',
  styleUrls: ['./transactions.component.scss']
})
export class TransactionsComponent implements OnInit {
  transactionsForm!: FormGroup;
  isLoading = false;
  successMessage = '';
  errorMessage = '';
  userBalance: number = 0;

  // 2FA
  show2FAModal = false;
  pendingTransactionData: any;

  // ATM
  showATMCodeInput = false;
  pendingATMTransactionId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private transactionService: TransactionService,
    private accountService: AccountService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.transactionsForm = this.fb.group({
      type: ['deposit_manual', Validators.required],
      amount: [null, [Validators.required, Validators.min(1)]],
      recipient: [''],
      description: [''],
      billType: [''],
      billProvider: [''],
      billReference: [''],
      merchant: [''],
      product: [''],
      orderRef: [''],
      mobileMoneyPhone: [''],        
      provider: [''],
      cardNumber: [''],
      cardExp: [''],
      cardCvv: [''],
      iban: [''],
      bankName: ['']
    });

    this.transactionsForm.get('type')?.valueChanges.subscribe(type => this.updateValidators(type));

    this.accountService.balance$.subscribe(balance => this.userBalance = balance);
    this.accountService.refreshBalance();
  }

  private updateValidators(type: string) {
    const recipientControl = this.transactionsForm.get('recipient');
    const descriptionControl = this.transactionsForm.get('description');

    if (type === 'transfer') recipientControl?.setValidators([Validators.required, Validators.pattern(/^\d{12,15}$/)]);
    else if (type === 'wire') recipientControl?.setValidators([Validators.required, Validators.pattern(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/)]);
    else recipientControl?.clearValidators();
    recipientControl?.updateValueAndValidity();

    const descriptions: Record<string, string> = {
      deposit_manual: 'Dépôt manuel',
      deposit_mobile: 'Dépôt via Mobile Money',
      deposit_wire: 'Dépôt par virement',
      deposit_card: 'Dépôt carte bancaire',
      withdrawal_mobile: 'Retrait via Mobile Money',
      withdrawal_card: 'Retrait via carte bancaire',
      withdrawal_atm: 'Retrait par guichet automatique',
      transfer: 'Transfert interne',
      wire: 'Virement externe',
      bill_payment: 'Paiement de facture',
      purchase: 'Achat en ligne'
    };
    if (!descriptionControl?.value || descriptionControl.value === descriptions[type]) {
      descriptionControl?.setValue(descriptions[type] || '');
    }
  }
  submit() {
    if (this.transactionsForm.invalid) return;
    this.isLoading = true;
    this.successMessage = '';
    this.errorMessage = '';

    const type = this.transactionsForm.get('type')?.value;
    const amount = this.transactionsForm.get('amount')?.value;
    this.pendingTransactionData = { type, amount, form: this.transactionsForm.value };

    this.authService.ensureUserLoaded().pipe(take(1)).subscribe(user => {
      this.isLoading = false;

      if (user && user.two_factor_enabled) {
        // Afficher le modal seulement si l'utilisateur a activé la 2FA
        this.show2FAModal = true;
      } else {
        // Exécuter directement la transaction si pas de 2FA
        this.executeTransaction(this.pendingTransactionData);
      }
    });
  }
  submit2FAToken(token: string) {
    if (!this.pendingTransactionData) return;
    this.authService.ensureUserLoaded().pipe(take(1)).subscribe(user => {
      if (!user || !user.id) {
        this.errorMessage = '❌ Utilisateur non connecté';
        this.show2FAModal = false;
        return;
      }
      this.authService.validate2FAToken(user.id, token).subscribe({
        next: response => {
          if (response.success) {
            this.show2FAModal = false;
            this.executeTransaction(this.pendingTransactionData);
          } else {
            this.errorMessage = response.message || '❌ Code 2FA invalide';
          }
        },
        error: err => this.errorMessage = err?.message || '❌ Erreur lors de la validation 2FA'
      });
    });
  }

  private executeTransaction(data: any) {
    const { type, amount, form } = data;
    let request$;

    switch (type) {
      case 'deposit_mobile':
        if (!form.mobileMoneyPhone) { this.errorMessage = '📱 Numéro Mobile Money requis'; return; }
        request$ = this.transactionService.createMobileMoneyDeposit(amount, form.mobileMoneyPhone, form.provider);
        break;
      case 'deposit_card':
        if (!form.cardNumber || !form.cardExp || !form.cardCvv) { this.errorMessage = '💳 Infos de carte incomplètes'; return; }
        request$ = this.transactionService.createCardDeposit(amount, { number: form.cardNumber, exp: form.cardExp, cvv: form.cardCvv });
        break;
      case 'deposit_wire':
        if (!form.iban || !form.bankName) { this.errorMessage = '🏦 IBAN et nom de banque requis'; return; }
        request$ = this.transactionService.createWireDeposit(amount, form.iban, form.bankName);
        break;
      case 'deposit_manual':
        request$ = this.transactionService.createManualDeposit(amount);
        break;
      case 'bill_payment':
        const billType = form.billType;           
        const billProvider = (form.billProvider && form.billProvider.trim() !== '') ? form.billProvider.trim() : billType;
        const reference = form.billReference || null;
        if (!billType || !reference) {
          this.errorMessage = '📄 Tous les champs de la facture sont obligatoires';
          return;
        }
        request$ = this.transactionService.createBillPayment({
          type: billType,
          provider: billProvider,
          amount,
          reference
        });
        break;
      case 'withdrawal_atm':
        this.transactionService.createATMWithdrawal(amount).subscribe({
          next: (res: any) => {
            if (!res.atmWithdrawalId) {
              this.errorMessage = '❌ Impossible de générer le code ATM';
              return;
            }
            this.pendingATMTransactionId = res.atmWithdrawalId;
            this.showATMCodeInput = true;
            this.successMessage = '📩 Code ATM envoyé par SMS/email';
            this.errorMessage = '';
          },
          error: (err: any) => {
            this.errorMessage = err.error?.message || '❌ Erreur lors de la génération du code ATM';
            this.successMessage = '';
          }
        });
        return; 
      default:
        request$ = this.transactionService.createTransaction({ type, amount, metadata: form });
    }

    request$?.subscribe({
      next: (res: any) => {
        this.successMessage = res?.message || '✅ Transaction réussie';
        this.errorMessage = '';
        this.transactionsForm.reset({ type: 'deposit_manual' });
        this.accountService.refreshBalance();
      },
      error: (err: any) => {
        this.errorMessage = err.error?.message || '❌ Erreur lors de la transaction';
        this.successMessage = '';
      }
    });
  }

  get labelForRecipient(): string {
    const type = this.transactionsForm.get('type')?.value;
    if (type === 'transfer') return 'RIB du bénéficiaire (interne)';
    if (type === 'wire') return 'IBAN du bénéficiaire (externe)';
    return '';
  }

  submitATMCode(code: string) {
    if (!this.pendingATMTransactionId) {
      this.errorMessage = '❌ Aucun retrait ATM en attente';
      return;
    }
    if (!code || code.trim().length !== 6) {
      this.errorMessage = '❌ Veuillez entrer le code ATM à 6 chiffres';
      return;
    }

    this.transactionService.validateATMCode(this.pendingATMTransactionId, code.trim()).subscribe({
      next: (res: any) => {
        this.successMessage = res.message || '✅ Retrait ATM réussi';
        this.errorMessage = '';
        this.showATMCodeInput = false;
        this.pendingATMTransactionId = null;
        this.transactionsForm.reset({ type: 'deposit_manual' });
        this.accountService.refreshBalance();
      },
      error: (err: any) => {
        if (err.status === 404) this.errorMessage = '❌ Transaction introuvable ou déjà utilisée';
        else if (err.status === 400) this.errorMessage = err.error?.message || '❌ Code ATM invalide';
        else if (err.status === 403) this.errorMessage = err.error?.message || '❌ Nombre maximal de tentatives atteint';
        else this.errorMessage = '❌ Erreur lors de la validation du code ATM';
        this.successMessage = '';
      }
    });
  }

  cancelATMCode() {
    this.showATMCodeInput = false;
    this.pendingATMTransactionId = null;
  }
}

