import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const snackBar = inject(MatSnackBar);

  return next(req).pipe(
    catchError((error) => {
      if (error.status === 401) {
        localStorage.removeItem('auth_token');

        snackBar.open('Session expirée ou non autorisée. Veuillez vous reconnecter.', 'Fermer', {
          duration: 5000,
          panelClass: ['snack-error'],
        });

        router.navigate(['/auth/login']);
      }

      if (error.status === 403) {
        snackBar.open('Accès refusé : permission insuffisante.', 'Fermer', {
          duration: 5000,
          panelClass: ['snack-error'],
        });

        router.navigate(['/unauthorized']);
      }

      return throwError(() => error);
    })
  );
};
