import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './admin-login.component.html',
  styleUrls: ['./admin-login.component.scss']
})
export class AdminLoginComponent implements OnInit{
  form!: FormGroup;
  errorMessage = '';
  isLoading = false;

  constructor(
    private fb: FormBuilder, 
    private http: HttpClient, 
    private router: Router, 
    private authService: AuthService) { }

  ngOnInit(): void {
    this.form = this.fb.group({
      login: ['', Validators.required],
      password: ['', Validators.required]
    });

    // Réinitialiser toute session existante quand on arrive sur la page de login
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  }

  onSubmit() {
  if (this.form.invalid) return;

  this.isLoading = true;
  this.errorMessage = '';

  const credentials = {
    login: this.form.value.login.trim(),
    password: this.form.value.password
  };

  // Réinitialise le token avant nouvelle tentative
  localStorage.removeItem('auth_token');

  this.authService.login(credentials, 'admin').subscribe({
    next: () => {
      this.isLoading = false;
      // Redirection gérée par AuthService
    },
    error: err => {
      this.isLoading = false;
      this.errorMessage = err.error?.message || '❌ Identifiants invalides';
    }
  });
}

}
