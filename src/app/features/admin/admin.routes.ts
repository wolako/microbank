import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role/role.guard';

export const adminRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./admin-dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent),
    canActivate: [roleGuard(['admin', 'account_manager', 'loan_officer', 'support'])],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard'
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./admin-dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent),
        canActivate: [roleGuard(['admin', 'account_manager', 'loan_officer', 'support'])]
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./user-management/user-management.component').then(m => m.UserManagementComponent),
        canActivate: [roleGuard(['admin', 'account_manager', 'support'])]
      },
      {
        path: 'loans',
        loadComponent: () =>
          import('./loan-management/loan-management.component').then(m => m.LoanManagementComponent),
        canActivate: [roleGuard(['admin', 'account_manager'])]
      },
      {
        path: 'approvals',
        loadComponent: () =>
          import('./loan-approval/loan-approval.component').then(m => m.LoanApprovalComponent),
        canActivate: [roleGuard(['admin', 'loan_officer'])]
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./loan-products/loan-products.component').then(m => m.LoanProductsComponent),
        canActivate: [roleGuard(['admin', 'account_manager'])]
      },
      {
        path: 'roles',
        loadComponent: () =>
          import('./user-role-management/user-role-management.component').then(m => m.UserRoleManagementComponent),
        canActivate: [roleGuard(['admin'])]
      }
    ]
  }
];
