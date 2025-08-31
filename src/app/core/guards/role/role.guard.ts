import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import { map } from 'rxjs/operators';

export function roleGuard(allowedRoles: string[]): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    return authService.ensureUserLoaded().pipe(
      map(user => {
        if (!user) {
          // Pas connecté → on renvoie vers login classique
          return router.createUrlTree(['/login']);
        }

        if (!allowedRoles.includes(user.role)) {
          // Rôle non autorisé → on redirige vers son tableau de bord correct
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
        }

        return true; // rôle valide → on laisse passer
      })
    );
  };
}
