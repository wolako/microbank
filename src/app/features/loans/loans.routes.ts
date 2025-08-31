import { Routes } from '@angular/router';

export const LOAN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./loans/loans.component').then(m => m.LoansComponent),
    title: 'Mes prêts - MicroFinance'
  },
  {
    path: 'apply/:id',
    loadComponent: () => 
      import('./loan-apply/loan-apply.component').then(m => m.LoanApplyComponent),
    title: 'Demande de prêt - MicroFinance'
  },
  // {
  //   path: 'apply/:id',
  //   loadComponent: () => 
  //     import('../../shared/components/formulaire-pret/formulaire-pret.component').then(m => m.FormulairePretComponent),
  //   title: 'Demande de prêt - MicroFinance'
  // },
  {
    path: 'listes',
    loadComponent: () =>
      import('./loans-list/loans-list.component').then(m => m.LoansListComponent),
    title: 'Mes listes des prêts - MicroFinance'
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./loan-details/loan-details.component').then(m => m.LoanDetailsComponent),
    title: 'Détails du prêt - MicroFinance'
  }
];
