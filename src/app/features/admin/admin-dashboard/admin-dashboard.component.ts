import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth/auth.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss'
})
export class AdminDashboardComponent implements OnInit {
  stats: any = {};
  userRole: string | null = null;
  chartData: any[] = [];

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.http.get(`${environment.apiUrl}/admin/stats`).subscribe({
      next: (res: any) => { this.stats = res; },
      error: err => console.error(err)
    });

    this.authService.user$.subscribe(user => {
      this.userRole = user?.role ?? null;
    });
  }

  canAccess(feature: string): boolean {
    const rolePermissions: Record<string, string[]> = {
      admin: ['stats', 'users', 'loans', 'approvals', 'products', 'roles'],
      account_manager: ['users', 'loans', 'products'],
      loan_officer: ['approvals'],
      support: ['users'],
      // ajoute d'autres rôles si besoin
    };

    if (!this.userRole) return false;
    return rolePermissions[this.userRole]?.includes(feature) ?? false;
  }
}
