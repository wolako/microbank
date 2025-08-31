import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { environment } from '../../../../environments/environment';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './verify-email.component.html',
  styleUrl: './verify-email.component.scss'
})
export class VerifyEmailComponent {

  loading = false;
  message = '';
  private apiUrl = environment.apiUrl;
  
  constructor(private http: HttpClient) {}

  resendEmail() {
    this.loading = true;
    this.message = '';

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    this.http
      .post(`${this.apiUrl}/auth/resend-confirmation`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .subscribe({
        next: () => {
          this.loading = false;
          this.message = '📨 Email de confirmation renvoyé avec succès.';
        },
        error: () => {
          this.loading = false;
          this.message = '❌ Une erreur est survenue.';
        }
      });
  }
}
