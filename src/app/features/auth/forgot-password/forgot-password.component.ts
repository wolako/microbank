import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss']
})
export class ForgotPasswordComponent {
  form!: FormGroup;
  submitted = false;
  successMessage = '';
  errorMessage = '';
  isLoading = false;

  constructor(private fb: FormBuilder, private authService: AuthService) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    this.isLoading = true;
    this.successMessage = '';
    this.errorMessage = '';
    this.submitted = true;

    this.authService.requestPasswordReset(this.form.value.email).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.successMessage = '✅ Un lien de réinitialisation a été envoyé à votre adresse email.';
        this.form.reset();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || '❌ Une erreur est survenue.';
      }
    });
  }
}
