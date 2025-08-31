import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  form!: FormGroup;
  twoFAForm!: FormGroup;
  errorMessage = '';
  isLoading = false;
  shouldShowResendLink = false;
  unverifiedEmail = '';
  twoFARequired = false;
  pendingUserId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      login: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', Validators.required]
    });

    this.twoFAForm = this.fb.group({
      token: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]]
    });
  }

  // ======= Soumission login classique =======
  // Connexion initiale
  onSubmit(): void {
    if (this.form.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';

    const credentials = {
      login: this.form.value.login,
      password: this.form.value.password
    };

    this.authService.login(credentials, 'user').subscribe({
      next: (response: any) => {
        this.isLoading = false;
        if (response.twoFactorRequired) {
          this.twoFARequired = true;
          this.pendingUserId = response.user.id;
        }
        // Redirection gérée par AuthService
      },
      error: (err: any) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || '❌ Identifiants invalides';
      }
    });
  }

  // Validation 2FA
  onSubmit2FA(): void {
      if (this.twoFAForm.invalid || !this.pendingUserId) return;

      this.isLoading = true;
      this.errorMessage = '';

      const token = this.twoFAForm.value.token;

      this.authService.validate2FAToken(this.pendingUserId, token).subscribe({
        next: (res: any) => {
          this.isLoading = false;
          localStorage.setItem('auth_token', res.token);
          this.authService.refreshUser();
          this.router.navigate(['/dashboard']);
        },
        error: (err: any) => {
          this.isLoading = false;
          this.errorMessage = err.error?.error || '❌ Code 2FA invalide';
        }
      });
  }


  resendEmailVerification(): void {
    this.authService.resendVerificationEmail().subscribe({
      next: () => {
        this.errorMessage = `📩 Un lien a été renvoyé à ${this.unverifiedEmail}.`;
        this.shouldShowResendLink = false;
      },
      error: () => {
        this.errorMessage = "Erreur lors de l'envoi de l'email.";
      }
    });
  }
}
