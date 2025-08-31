import { Routes } from '@angular/router'; 
import { MainLayoutComponent } from './shared/layouts/main-layout/main-layout.component';
import { authGuard } from './core/guards/auth.guard';
import { nonAuthGuard } from './core/guards/non-auth.guard';
import { roleGuard } from './core/guards/role/role.guard';
import { VerifyEmailComponent } from './features/auth/verify-email/verify-email.component';
import { ConfirmEmailComponent } from './features/auth/confirm-email/confirm-email.component';

export const routes: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent),
        title: 'Accueil - MicroFinance'
      },
      {
        path: 'contact',
        loadComponent: () => import('./features/contact/contact.component').then(m => m.ContactComponent),
        title: 'Contact - MicroFinance'
      },
      {
        path: 'about',
        loadComponent: () => import('./features/about/about.component').then(m => m.AboutComponent),
        title: 'About - MicroFinance'
      },
      {
        path: 'loans',
        loadChildren: () => import('./features/loans/loans.routes').then(m => m.LOAN_ROUTES)
      },
      {
        path: 'accounts',
        canActivate: [authGuard, roleGuard(['user'])],
        loadComponent: () => import('./features/comptes/accounts/accounts.component').then(m => m.AccountsComponent),
        title: 'Mon compte'
      },
      {
        path: 'rib',
        canActivate: [authGuard, roleGuard(['user'])],
        loadComponent: () => import('./features/comptes/rib/rib.component').then(m => m.RibComponent)
      },
      {
        path: 'transactions/history',
        canActivate: [authGuard, roleGuard(['user'])],
        loadComponent: () => import('./features/comptes/transactions-history/transactions-history.component')
          .then(m => m.TransactionsHistoryComponent),
        title: 'Historique des transactions - MicroFinance'
      },
      {
        path: 'transactions/:id',
        canActivate: [authGuard, roleGuard(['user'])],
        loadComponent: () => import('./features/comptes/transactions-details/transactions-details.component')
          .then(m => m.TransactionsDetailsComponent)
      },
      {
        path: 'transactions',
        canActivate: [authGuard, roleGuard(['user'])],
        loadComponent: () => import('./features/comptes/transactions/transactions.component').then(m => m.TransactionsComponent),
        title: 'Mes Transactions - MicroFinance'
      },
      {
        path: 'services',
        loadChildren: () => import('./features/services/services.routes').then(m => m.servicesRoutes)
      },

      // Tableau de bord utilisateur
      {
        path: 'dashboard',
        canActivate: [authGuard, roleGuard(['user'])],
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
        title: 'Tableau de bord Client'
      },

      // Tableau de bord admin (accès direct)
      {
        path: 'dashboard/admin',
        canActivate: [authGuard, roleGuard(['admin', 'account_manager', 'loan_officer', 'support'])],
        loadComponent: () => import('./features/admin/admin-dashboard/admin-dashboard.component')
          .then(m => m.AdminDashboardComponent),
        title: 'Dashboard Admin'
      },

      // Module admin complet
      {
        path: 'admin',
        canActivate: [authGuard, roleGuard(['admin', 'account_manager', 'loan_officer', 'support'])],
        loadChildren: () => import('./features/admin/admin.routes').then(m => m.adminRoutes)
      },

      // Création de comptes admin → seulement les super-admin
      {
        path: 'admin/create',
        canActivate: [authGuard, roleGuard(['admin'])],
        loadComponent: () => import('./features/admin/admin-create/admin-create.component')
          .then(m => m.AdminCreateComponent),
        title: 'Créer un compte administrateur'
      },

      {
        path: 'unauthorized',
        loadComponent: () => import('./features/public/unauthorized/unauthorized.component')
          .then(m => m.UnauthorizedComponent)
      }
    ]
  },

  // ====================
  // 🔐 Routes Auth publiques
  // ====================
  {
    path: 'login',
    canActivate: [nonAuthGuard],  // empêche d'accéder si déjà connecté
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent),
    title: 'Connexion - MicroFinance'
  },
  {
    path: 'register',
    canActivate: [nonAuthGuard],
    loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent),
    title: 'Inscription - MicroFinance'
  },
  {
    path: 'register-success',
    canActivate: [nonAuthGuard],
    loadComponent: () => import('./features/auth/register-success/register-success.component')
      .then(m => m.RegisterSuccessComponent)
  },
  {
    path: 'forgot-password',
    canActivate: [nonAuthGuard],
    loadComponent: () => import('./features/auth/forgot-password/forgot-password.component')
      .then(m => m.ForgotPasswordComponent),
    title: 'Mot de passe oublié - MicroFinance'
  },
  {
    path: 'auth/verify-email',
    component: VerifyEmailComponent,
    canActivate: [nonAuthGuard]
  },
  {
    path: 'auth/confirm-email',
    component: ConfirmEmailComponent,
    canActivate: [nonAuthGuard]
  },
  {
    path: 'auth/pending-approval',
    canActivate: [nonAuthGuard],
    loadComponent: () => import('./features/auth/pending-approval/pending-approval.component')
      .then(m => m.PendingApprovalComponent)
  },

  // 🔐 Page de login admin séparée
  {
    path: 'admin/login',
    canActivate: [nonAuthGuard],
    loadComponent: () => import('./features/admin/admin-login/admin-login.component').then(m => m.AdminLoginComponent),
    title: 'Connexion Admin'
  },

  {
    path: 'reset-password',
    canActivate: [nonAuthGuard],
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
    title: 'Réinitialisation du mot de passe - MicroFinance'
  },

  // Redirection par défaut
  {
    path: '**',
    redirectTo: ''
  }
];
