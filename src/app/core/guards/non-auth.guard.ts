import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { AuthService } from '../services/auth/auth.service';

export const nonAuthGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.ensureUserLoaded().pipe(
    map(user => {
      if (!user) {
        return true; // pas connecté → accès autorisé
      }

      // déjà connecté → redirection selon rôle
      switch (user.role) {
        case 'admin':
        case 'account_manager':
        case 'loan_officer':
        case 'support':
          return router.createUrlTree(['/dashboard/admin']);
        default:
          return router.createUrlTree(['/dashboard']);
      }
    }),
    catchError(() => of(true)) // si erreur (pas connecté) → accès autorisé
  );
};
