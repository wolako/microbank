import { CommonModule } from '@angular/common';
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

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  // 🔹 Charger tous les utilisateurs
  loadUsers(): void {
    this.loading = true;
    this.api.get('admin/users').subscribe({
      next: (res: any) => {
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

  // 🔹 Vérifier le KYC d’un utilisateur
  verifyKYC(userId: string): void {
    this.api.post(`admin/users/${userId}/verify-kyc`, {}).subscribe({
      next: () => {
        this.users = this.users.map(u =>
          u.id === userId ? { ...u, kyc_verified: true } : u
        );
      },
      error: err => console.error('❌ Erreur lors de la vérification KYC :', err)
    });
  }

  // 🔹 Approuver un utilisateur
  approveUser(user: any): void {
    this.api.post(`admin/users/${user.id}/approve`, {}).subscribe({
      next: (res: any) => {
        if (res.user) {
          this.users = this.users.map(u =>
            u.id === user.id ? { ...u, is_approved: true } : u
          );
        }
      },
      error: err => console.error('❌ Erreur lors de l\'approbation :', err)
    });
  }

  // 🔹 Supprimer un utilisateur
  deleteUser(userId: string): void {
    if (!confirm('Voulez-vous vraiment supprimer cet utilisateur ?')) return;

    this.api.delete(`admin/users/${userId}`).subscribe({
      next: () => {
        this.users = this.users.filter(u => u.id !== userId);
      },
      error: err => console.error('❌ Erreur lors de la suppression :', err)
    });
  }
}
