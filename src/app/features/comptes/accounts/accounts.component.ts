import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormControl, FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth/auth.service';
import { UserService } from '../../../core/services/users/user.service';
import { DocumentsService } from '../../../core/services/documents/documents.service';
import { UserDocument } from '../../../shared/models/document.model';
import { TransactionsComponent } from '../transactions/transactions.component';
import { ToastService } from '../../../core/services/toast/toast.service';
import { ToastComponent } from '../../../shared/components/toast/toast.component';
import { animate, style, transition, trigger } from '@angular/animations';


@Component({
  selector: 'app-accounts',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, TransactionsComponent, ToastComponent],
  templateUrl: './accounts.component.html',
  styleUrls: ['./accounts.component.scss'],
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(10px)' }))
      ])
    ])
  ]
})
export class AccountsComponent implements OnInit {
  userData: any;
  activeTab = 'profile';
  isEditing = false;
  isLoading = false;

  documents: UserDocument[] = [];
  uploading = false;
  selectedFile: File | null = null;

  // 2FA
  twoFactorEnabled = false;
  show2FAModal = false;
  qrCodeUrl = '';
  twoFactorToken = '';
  twoFactorError = '';
  isLoading2FA = false;

  // Formulaires
  profileForm = this.fb.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['']
  });

  passwordForm = this.fb.group({
    oldPassword: ['', [Validators.required]],
    newPassword: ['', [
      Validators.required,
      Validators.minLength(8),
      Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/)
    ]],
    confirmPassword: ['', [Validators.required]]
  }, { validator: this.passwordMatchValidator });

  notificationForm = this.fb.group({
    email_notifications_enabled: [false],
    sms_notifications_enabled: [false]
  });

  // Password state
  showPasswordForm = false;
  passwordError = '';
  passwordSuccess = false;

  constructor(
    public authService: AuthService,
    private userService: UserService,
    private fb: FormBuilder,
    private documentsService: DocumentsService,
    private toastService: ToastService
  ) {}

  ngOnInit() {
    this.loadUserData();
    this.loadDocuments();
  }

  // ================== Documents ==================
  loadDocuments() {
    this.documentsService.getDocuments().subscribe({
      next: docs => this.documents = docs,
      error: () => this.toastService.show('error', 'Impossible de charger vos documents ❌')
    });
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    this.selectedFile = input.files[0];
    const formData = new FormData();
    formData.append('document', this.selectedFile);

    this.uploading = true;
    this.documentsService.uploadDocument(formData).subscribe({
      next: doc => {
        this.documents.unshift(doc);
        this.uploading = false;
        this.toastService.show('success', 'Document ajouté ✅');
      },
      error: () => {
        this.uploading = false;
        this.toastService.show('error', 'Échec de l’upload ❌');
      }
    });
  }

  deleteDocument(docId: number) {
    this.documentsService.deleteDocument(docId).subscribe({
      next: () => {
        this.documents = this.documents.filter(d => d.id !== docId);
        this.toastService.show('success', 'Document supprimé ✅');
      },
      error: () => this.toastService.show('error', 'Impossible de supprimer le document ❌')
    });
  }

  downloadDocument(doc: UserDocument) {
    this.documentsService.downloadDocument(doc.id).subscribe(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = doc.original_name;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  // ================== Profil ==================
  loadUserData() {
    this.authService.ensureUserLoaded().subscribe(user => {
      if (user) {
        this.userData = user;
        this.profileForm.patchValue({
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone
        });

        this.notificationForm.patchValue({
          email_notifications_enabled: user.email_notifications_enabled ?? false,
          sms_notifications_enabled: user.sms_notifications_enabled ?? false
        });

        this.twoFactorEnabled = user.two_factor_enabled ?? false;
      }
    });
  }

  updateProfile() {
    if (this.profileForm.invalid) {
      this.toastService.show('error', 'Veuillez corriger les erreurs du formulaire ⚠️');
      return;
    }

    this.isLoading = true;
    const { firstName, lastName, email, phone } = this.profileForm.value;

    this.userService.updateProfile({ firstName, lastName, email, phone }).subscribe({
      next: () => {
        this.isEditing = false;
        this.isLoading = false;
        this.loadUserData();
        this.toastService.show('success', 'Profil mis à jour ✅');
      },
      error: () => {
        this.isLoading = false;
        this.toastService.show('error', 'Erreur lors de la mise à jour ❌');
      }
    });
  }

  cancelEdit() {
    this.isEditing = false;
    this.loadUserData();
  }

  // ================== Notifications ==================
  updateNotificationPreferences() {
    const prefs = this.notificationForm.value as {
      email_notifications_enabled: boolean;
      sms_notifications_enabled: boolean;
    };

    this.userService.updateNotificationPreferences(prefs).subscribe({
      next: () => this.toastService.show('success', 'Préférences mises à jour ✅'),
      error: () => this.toastService.show('error', 'Erreur mise à jour notifications ❌')
    });
  }

  get emailNotificationsControl(): FormControl {
    return this.notificationForm.get('email_notifications_enabled') as FormControl;
  }
  get smsNotificationsControl(): FormControl {
    return this.notificationForm.get('sms_notifications_enabled') as FormControl;
  }

  // ================== Mot de passe ==================
  passwordMatchValidator(group: FormGroup) {
    const newPassword = group.get('newPassword')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return newPassword === confirmPassword ? null : { mismatch: true };
  }

  changePassword() {
    if (this.passwordForm.invalid) {
      this.passwordError = 'Veuillez remplir correctement tous les champs';
      return;
    }
    if (this.passwordForm.hasError('mismatch')) {
      this.passwordError = 'Les mots de passe ne correspondent pas';
      return;
    }

    this.isLoading = true;
    this.passwordError = '';
    this.passwordSuccess = false;

    const { oldPassword, newPassword } = this.passwordForm.value;

    this.userService.changePassword({ oldPassword, newPassword }).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        this.passwordSuccess = true;
        this.passwordForm.reset();

        if (res.passwordUpdatedAt) {
          this.userData.passwordUpdatedAt = res.passwordUpdatedAt;
        }

        this.toastService.show('success', 'Mot de passe changé ✅');

        setTimeout(() => {
          this.showPasswordForm = false;
          this.passwordSuccess = false;
        }, 3000);
      },
      error: (err) => {
        this.isLoading = false;
        this.passwordError = err.error?.message || 'Erreur lors du changement de mot de passe';
        this.toastService.show('error', this.passwordError);
      }
    });
  }

  // Helpers affichage règles password
  hasMinLength(): boolean { return (this.passwordForm.get('newPassword')?.value || '').length >= 8; }
  hasUpperCase(): boolean { return /[A-Z]/.test(this.passwordForm.get('newPassword')?.value || ''); }
  hasLowerCase(): boolean { return /[a-z]/.test(this.passwordForm.get('newPassword')?.value || ''); }
  hasNumber(): boolean { return /\d/.test(this.passwordForm.get('newPassword')?.value || ''); }
  hasSpecialChar(): boolean { return /[@$!%*?&]/.test(this.passwordForm.get('newPassword')?.value || ''); }

  // ================== 2FA ==================
  toggleTwoFactor(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.isLoading2FA = true;
    this.twoFactorError = '';

    if (checked) {
      this.userService.setupTwoFactor().subscribe({
        next: res => {
          this.qrCodeUrl = res?.qrDataUrl || '';
          if (!this.qrCodeUrl) {
            this.twoFactorError = 'Impossible de générer le QR code';
          } else {
            this.show2FAModal = true;
          }
          this.isLoading2FA = false;
        },
        error: () => {
          this.twoFactorError = 'Erreur lors de l’activation 2FA';
          this.isLoading2FA = false;
        }
      });
    } else {
      this.userService.disableTwoFactor().subscribe({
        next: () => {
          this.authService.refreshUser();
          this.toastService.show('success', '2FA désactivée ✅');
          this.isLoading2FA = false;
        },
        error: () => {
          this.twoFactorError = 'Erreur lors de la désactivation';
          this.isLoading2FA = false;
        }
      });
    }
  }

  confirmTwoFactor() {
    if (!/^\d{6}$/.test(this.twoFactorToken)) {
      this.twoFactorError = 'Code invalide';
      return;
    }

    this.isLoading2FA = true;
    this.twoFactorError = '';

    this.userService.verifyTwoFactor(this.twoFactorToken).subscribe({
      next: res => {
        if (res.success) {
          this.show2FAModal = false;
          this.twoFactorToken = '';
          this.authService.refreshUser();
          this.toastService.show('success', '2FA activée ✅');
        } else {
          this.twoFactorError = 'Code incorrect';
        }
        this.isLoading2FA = false;
      },
      error: () => {
        this.twoFactorError = 'Code invalide ou expiré';
        this.isLoading2FA = false;
      }
    });
  }
}
