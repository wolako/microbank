import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api/api.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-user-role-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-role-management.component.html',
  styleUrl: './user-role-management.component.scss'
})
export class UserRoleManagementComponent implements OnInit {
  users: any[] = [];
  roles = [
    { value: 'admin', label: 'Administrateur' },
    { value: 'loan_officer', label: 'Agent de prêt' },
    { value: 'account_manager', label: 'Gestionnaire de compte' },
    { value: 'support', label: 'Support client' },
    { value: 'auditor', label: 'Auditeur' },
    { value: 'compliance', label: 'Agent conformité' },
    { value: 'user', label: 'Client standard' }
  ];
  successMessage: string | null = null;
  errorMessage: string | null = null;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers() {
    this.api.get('admin/users').subscribe({
      next: (res: any) => {
        this.users = res.filter((user: any) => user.role !== 'super_admin');
      },
      error: err => {
        console.error(err);
        this.errorMessage = 'Erreur de chargement des utilisateurs';
      }
    });
  }

  updateUserRole(userId: string, newRole: string) {
    this.successMessage = null;
    this.errorMessage = null;

    this.api.put(`admin/users/${userId}/role`, { role: newRole }).subscribe({
      next: (res: any) => {
        this.successMessage = res.message || "Rôle mis à jour avec succès";
        const updatedUser = this.users.find(u => u.id === userId);
        if (updatedUser) updatedUser.role = res.user?.role || newRole;
      },
      error: (err: any) => {
        console.error(err);
        this.errorMessage = err.error?.error || "Une erreur s'est produite";
      }
    });
  }

  deleteUser(userId: string) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cette action est irréversible.")) {
      return;
    }

    this.successMessage = null;
    this.errorMessage = null;

    this.api.delete(`admin/users/${userId}`).subscribe({
      next: (res: any) => {
        this.successMessage = res.message || "Utilisateur supprimé avec succès";
        this.users = this.users.filter(u => u.id !== userId);
      },
      error: (err: any) => {
        console.error(err);
        this.errorMessage = err.error?.error || "Une erreur s'est produite lors de la suppression";
      }
    });
  }
}
