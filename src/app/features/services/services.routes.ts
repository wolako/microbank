import { Routes } from '@angular/router';
import { ServiceDetailComponent } from './service-detail/service-detail.component';


export const servicesRoutes: Routes = [
  
  {
    path: ':id',
    loadComponent: () => import('./service-detail/service-detail.component').then(m => m.ServiceDetailComponent),
    title: 'Détails du service - MicroFinance'
  }
];
