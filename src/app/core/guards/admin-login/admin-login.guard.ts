import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { AuthService } from '../../services/auth/auth.service';

export const adminLoginGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.ensureUserLoaded().pipe(
    map(user => {
      if (!user) return true; // pas connecté → on peut accéder

      switch (user.role) {
        case 'admin':
        case 'account_manager':
        case 'loan_officer':
        case 'support':
          return router.createUrlTree(['/dashboard/admin']);
        case 'user':
          return router.createUrlTree(['/dashboard']);
        default:
          return router.createUrlTree(['/login']); // rôle inconnu → login
      }
    })
  );
};
