import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormControl, FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth/auth.service';
import { UserService } from '../../../core/services/users/user.service';
import { TransactionsComponent } from '../transactions/transactions.component';
import { DocumentsService } from '../../../core/services/documents/documents.service';
import { UserDocument } from '../../../shared/models/document.model';

@Component({
  selector: 'app-accounts',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, TransactionsComponent],
  templateUrl: './accounts.component.html',
  styleUrls: ['./accounts.component.scss']
})
export class AccountsComponent implements OnInit {
  userData: any;
  activeTab = 'profile';
  isEditing = false;
  isLoading = false;

  documents: UserDocument[] = [];
  uploading = false;
  selectedFile: File | null = null;

  // 2FA UI state
  twoFactorEnabled = false;
  show2FAModal = false;
  qrCodeUrl = '';
  twoFactorToken = '';
  twoFactorError = '';
  isLoading2FA = false;

  profileForm = this.fb.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    address: this.fb.group({
      street: [''],
      city: [''],
      postalCode: ['']
    })
  });

  showPasswordForm = false;
  passwordError = '';
  passwordSuccess = false;

  constructor(
    public authService: AuthService,
    private userService: UserService,
    private fb: FormBuilder,
    private documentsService: DocumentsService
  ) {}

  ngOnInit() {
    this.loadUserData();
    this.loadDocuments();
  }

  loadDocuments() {
    this.documentsService.getDocuments().subscribe({
      next: docs => this.documents = docs,
      error: err => console.error('Erreur chargement documents:', err)
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
      },
      error: err => {
        console.error(err);
        this.uploading = false;
      }
    });
  }

  deleteDocument(docId: number) {
    this.documentsService.deleteDocument(docId).subscribe({
      next: () => this.documents = this.documents.filter(d => d.id !== docId),
      error: err => console.error(err)
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

  passwordForm = this.fb.group({
    oldPassword: ['', [Validators.required]],
    newPassword: ['', [
      Validators.required,
      Validators.minLength(8),
      Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/)
    ]],
    confirmPassword: ['', [Validators.required]]
  }, { validator: this.passwordMatchValidator });

  passwordMatchValidator(group: FormGroup) {
    const newPassword = group.get('newPassword')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return newPassword === confirmPassword ? null : { mismatch: true };
  }

  notificationForm = this.fb.group({
    email_notifications_enabled: [false],
    sms_notifications_enabled: [false]
  });

  loadUserData() {
    this.authService.ensureUserLoaded().subscribe(user => {
      if (user) {
        this.userData = user;
        this.profileForm.patchValue(user);

        // Notifications
        this.notificationForm.patchValue({
          email_notifications_enabled: user.email_notifications_enabled ?? false,
          sms_notifications_enabled: user.sms_notifications_enabled ?? false
        });

        // 2FA
        this.twoFactorEnabled = user.two_factor_enabled ?? false;
      }
    });
  }

  updateProfile() {
    if (this.profileForm.invalid) return;

    this.isLoading = true;
    this.userService.updateProfile(this.profileForm.value).subscribe({
      next: () => {
        this.isEditing = false;
        this.isLoading = false;
        this.loadUserData();
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  updateNotificationPreferences() {
    const prefs = this.notificationForm.value as {
      email_notifications_enabled: boolean;
      sms_notifications_enabled: boolean;
    };

    this.userService.updateNotificationPreferences({
      email_notifications_enabled: prefs.email_notifications_enabled,
      sms_notifications_enabled: prefs.sms_notifications_enabled
    }).subscribe({
      next: () => {},
      error: (err) => console.error('Erreur mise à jour notifications :', err)
    });
  }

  changePassword() {
    if (this.passwordForm.invalid) {
      this.passwordError = 'Veuillez remplir correctement tous les champs';
      return;
    }

    if (this.passwordForm.hasError('mismatch')) {
      this.passwordError = 'Les nouveaux mots de passe ne correspondent pas';
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

        // Mettre à jour la date dans userData
        if (res.passwordUpdatedAt) {
          this.userData.passwordUpdatedAt = res.passwordUpdatedAt;
        }

        setTimeout(() => {
          this.showPasswordForm = false;
          this.passwordSuccess = false;
        }, 3000);
      },
      error: (err) => {
        this.isLoading = false;
        this.passwordError = err.error?.message || 'Erreur lors du changement de mot de passe';
      }
    });
  }

  get emailNotificationsControl(): FormControl {
    return this.notificationForm.get('email_notifications_enabled') as FormControl;
  }

  get smsNotificationsControl(): FormControl {
    return this.notificationForm.get('sms_notifications_enabled') as FormControl;
  }

  // ---------------- 2FA ----------------
  toggleTwoFactor(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.isLoading2FA = true;
    this.twoFactorError = '';

    if (checked) {
      // Setup 2FA: récupérer QR code et afficher modal
      this.userService.setupTwoFactor().subscribe({
        next: res => {
          // le backend renvoie { qrDataUrl, secret }
          this.qrCodeUrl = res?.qrDataUrl || '';
          if (!this.qrCodeUrl) {
            this.twoFactorError = 'Impossible de générer le QR code';
          } else {
            this.show2FAModal = true;
          }
          this.isLoading2FA = false;
        },
        error: err => {
          console.error('Erreur setup 2FA:', err);
          this.twoFactorError = err.error?.error || 'Erreur serveur';
          this.isLoading2FA = false;
        }
      });
    } else {
      // Désactivation 2FA
      this.userService.disableTwoFactor().subscribe({
        next: () => {
          // Recharger le profil pour refléter l’état
          this.authService.refreshUser();
          this.authService.getCurrentUser().subscribe(user => {
            this.twoFactorEnabled = user?.two_factor_enabled ?? false;
          });
          this.isLoading2FA = false;
        },
        error: err => {
          console.error('Erreur désactivation 2FA:', err);
          this.twoFactorError = err.error?.error || 'Erreur serveur';
          this.isLoading2FA = false;
        }
      });
    }
  }

  confirmTwoFactor() {
    if (!this.twoFactorToken) {
      this.twoFactorError = 'Entrez le code à 6 chiffres';
      return;
    }
    if (!/^\d{6}$/.test(this.twoFactorToken)) {
      this.twoFactorError = 'Le code doit contenir 6 chiffres';
      return;
    }

    this.isLoading2FA = true;
    this.twoFactorError = '';

    this.userService.verifyTwoFactor(this.twoFactorToken).subscribe({
      next: res => {
        if (res.success) {
          this.show2FAModal = false;
          this.twoFactorToken = '';
          // Recharger le profil pour mettre à jour two_factor_enabled
          this.authService.refreshUser();
          this.authService.getCurrentUser().subscribe(user => {
            this.twoFactorEnabled = user?.two_factor_enabled ?? false;
          });
        } else {
          this.twoFactorError = 'Code invalide';
        }
        this.isLoading2FA = false;
      },
      error: err => {
        console.error('Erreur confirmation 2FA:', err);
        this.twoFactorError = err.error?.error || 'Code invalide ou expiré';
        this.isLoading2FA = false;
      }
    });
  }

  // ---------------- Password helpers ----------------
  hasMinLength(): boolean { return (this.passwordForm.get('newPassword')?.value || '').length >= 8; }
  hasUpperCase(): boolean { return /[A-Z]/.test(this.passwordForm.get('newPassword')?.value || ''); }
  hasLowerCase(): boolean { return /[a-z]/.test(this.passwordForm.get('newPassword')?.value || ''); }
  hasNumber(): boolean { return /\d/.test(this.passwordForm.get('newPassword')?.value || ''); }
  hasSpecialChar(): boolean { return /[@$!%*?&]/.test(this.passwordForm.get('newPassword')?.value || ''); }
}
