import { Component } from '@angular/core';
import { AbstractControl, AsyncValidatorFn, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth/auth.service';
import { catchError, debounceTime, map, of, switchMap } from 'rxjs';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent {
  registerForm: FormGroup;
  loading = false;
  errorMessage: string | null = null;
  passwordRequirements = [
    { text: 'Minimum 8 caractères', valid: false },
    { text: 'Au moins une majuscule', valid: false },
    { text: 'Au moins une minuscule', valid: false },
    { text: 'Au moins un chiffre', valid: false }
  ];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService
  ) {
    this.registerForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.pattern(/^[a-zA-ZÀ-ÿ\s]*$/)]],
      lastName: ['', [Validators.required, Validators.pattern(/^[a-zA-ZÀ-ÿ\s]*$/)]],
      email: ['', {
        validators: [Validators.required, Validators.email],
        asyncValidators: [this.emailAsyncValidator()],
        updateOn: 'blur'
      }],
      phone: ['', [Validators.required, Validators.pattern(/^\+?[0-9]{8,15}$/)]],
      password: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).*$/)
      ]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });

    this.registerForm.get('password')?.valueChanges.subscribe(val => {
      this.updatePasswordRequirements(val);
    });
  }

  updatePasswordRequirements(password: string) {
    this.passwordRequirements = [
      { text: 'Minimum 8 caractères', valid: password?.length >= 8 },
      { text: 'Au moins une majuscule', valid: /[A-Z]/.test(password) },
      { text: 'Au moins une minuscule', valid: /[a-z]/.test(password) },
      { text: 'Au moins un chiffre', valid: /[0-9]/.test(password) }
    ];
  }

  passwordMatchValidator(g: FormGroup) {
    const password = g.get('password')?.value;
    const confirmPassword = g.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { mismatch: true };
  }

  emailAsyncValidator(): AsyncValidatorFn {
    return (control: AbstractControl) => {
      return of(control.value).pipe(
        debounceTime(300),
        switchMap(email => this.authService.checkEmailExists(email)),
        map(exists => (exists ? { emailTaken: true } : null)),
        catchError(() => of(null))
      );
    };
  }

  onSubmit() {
    console.log('Form data:', this.registerForm.value);
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = null;

    const userData = { ...this.registerForm.value };

        // Normaliser le numéro de téléphone
    if (userData.phone.startsWith('00')) {
      userData.phone = '+' + userData.phone.slice(2);
    } else if (!userData.phone.startsWith('+')) {
      // Ajoute par défaut l'indicatif Togo si aucun préfixe n'est mis (optionnel)
      userData.phone = '+228' + userData.phone;
    }

    this.authService.register(userData).subscribe({
      next: (response) => {
        this.loading = false;
        this.router.navigate(['register-success'], {
          state: {
            email: userData.email,
            firstName: userData.firstName
          }
        });
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.message || 'Erreur lors de l\'inscription';
        console.error('Registration error:', err);
      }
    });
  }
}