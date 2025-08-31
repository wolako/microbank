import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth/auth.service';
import { map } from 'rxjs/operators';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.ensureUserLoaded().pipe(
    map(user => {
      if (!user) {
        // Si non connecté → par défaut on renvoie sur /login
        return router.createUrlTree(['/login']);
      }
      return true;
    })
  );
};
