// src/app/core/interceptors/two-factor.interceptor.ts
import { HttpEvent, HttpInterceptorFn, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, switchMap, throwError, of } from 'rxjs';

// On peut garder le ciblage des routes sensibles si on veut
const NEEDS_2FA = /\/(transactions|payments|loans|accounts\/verify-password|users\/change-password|withdraw|retrait|deposit|depot|external-incoming)/i;
const EXCLUDED_2FA = /\/users\/2fa\/(setup|verify|disable)/i;

// Evite de reprompter indéfiniment la même requête
const TWOFA_RETRY_FLAG = 'x-2fa-retried';

export const twoFactorInterceptor: HttpInterceptorFn = (req, next): Observable<HttpEvent<any>> => {
  // Laisse passer toutes les routes non sensibles, ou les routes 2FA elles-mêmes
  const isSensitive = NEEDS_2FA.test(req.url) && !EXCLUDED_2FA.test(req.url);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      // Ne gère que le cas 403 "Token 2FA requis" pour les routes sensibles
      const alreadyRetried = req.headers.get(TWOFA_RETRY_FLAG) === '1';
      const needs2fa = isSensitive && err.status === 403 && (err.error?.message === 'Token 2FA requis');

      if (!needs2fa || alreadyRetried) {
        return throwError(() => err);
      }

      // Demander un code à l'utilisateur (remplace window.prompt par ton modal plus tard)
      const code = window.prompt('Entrez votre code 2FA (6 chiffres) :')?.trim();

      if (!code || !/^\d{6}$/.test(code)) {
        // Pas de code ou format invalide → on renvoie l’erreur d’origine
        return throwError(() => err);
      }

      // Cloner la requête avec l’en-tête 2FA + un flag de retry
      const cloned = req.clone({
        setHeaders: {
          'X-2FA-Token': code,
          [TWOFA_RETRY_FLAG]: '1'
        }
      });

      // Ré-émettre une seule fois
      return next(cloned).pipe(
        catchError((secondErr: HttpErrorResponse) => {
          // Si c’est encore invalide, on renvoie l’erreur
          return throwError(() => secondErr);
        })
      );
    })
  );
};
