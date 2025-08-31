import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-admin-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './admin-create.component.html',
  styleUrls: ['./admin-create.component.scss']
})
export class AdminCreateComponent implements OnInit {
  form!: FormGroup;
  successMessage = '';
  errorMessage = '';

  roles = [
    { value: 'admin', label: 'Administrateur' },
    { value: 'loan_officer', label: 'Agent de prêt' },
    { value: 'account_manager', label: 'Gestionnaire de compte' },
    { value: 'support', label: 'Support client' },
    { value: 'auditor', label: 'Auditeur' },
    { value: 'compliance', label: 'Agent conformité' },
    { value: 'user', label: 'Client standard' }
  ];

  constructor(private fb: FormBuilder, private http: HttpClient) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.pattern(/^\+?\d{8,15}$/)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
      role: ['user', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(group: AbstractControl) {
    const password = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return password === confirm ? null : { passwordMismatch: true };
  }

  onSubmit(): void {
    this.successMessage = '';
    this.errorMessage = '';

    if (this.form.invalid) {
      this.errorMessage = '❌ Formulaire invalide. Veuillez corriger les erreurs.';
      return;
    }

    const { confirmPassword, ...data } = this.form.value;

    this.http.post(`${environment.apiUrl}/admin/create`, data).subscribe({
      next: () => {
        this.successMessage = `✅ Compte "${data.role}" créé avec succès.`;
        this.errorMessage = '';
        this.form.reset({ role: 'user' });
      },
      error: err => {
        console.error(err);
        this.successMessage = '';
        this.errorMessage = err.error?.message || '❌ Erreur lors de la création.';
      }
    });
  }

  // Getter pratique pour le template
  get f() { return this.form.controls; }
}
