import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../../core/services/api/api.service';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.scss']
})
export class UserManagementComponent implements OnInit {
  users: any[] = [];
  loading = true;

  constructor(private http: HttpClient, private api: ApiService) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.api.get('admin/users').subscribe({
      next: (res: any) => {
        // S'assure que is_approved et kyc_verified sont booléens
        this.users = res.map((u: any) => ({
          ...u,
          is_approved: !!u.is_approved,
          kyc_verified: !!u.kyc_verified
        }));
        this.loading = false;
      },
      error: err => {
        console.error('❌ Erreur chargement utilisateurs:', err);
        this.loading = false;
      }
    });
  }

  verifyKYC(userId: string): void {
    this.api.post(`admin/users/${userId}/verify-kyc`, {}).subscribe({
      next: () => {
        // Met à jour l'utilisateur dans le tableau
        this.users = this.users.map(u =>
          u.id === userId ? { ...u, kyc_verified: true } : u
        );
      },
      error: err => console.error('❌ Erreur lors de la vérification KYC :', err)
    });
  }

  approveUser(user: any): void {
    const url = `http://localhost:3000/api/admin/users/${user.id}/approve`;
    this.http.post<any>(url, {}, { headers: this.api['getHeaders']() }).subscribe({
      next: res => {
        if (res.user) {
          // Remplace l'utilisateur avec la version renvoyée par le backend
          this.users = this.users.map(u =>
            u.id === user.id ? { ...u, is_approved: true } : u
          );
        }
      },
      error: err => console.error('❌ Erreur lors de l\'approbation :', err)
    });
  }
}
