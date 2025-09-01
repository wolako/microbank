// import { HttpInterceptorFn } from '@angular/common/http';
// import { environment } from '../../../environments/environment'; // ajuste le chemin si besoin

// export const authInterceptor: HttpInterceptorFn = (req, next) => {
//   const token = localStorage.getItem('auth_token');

//   // On limite l’injection du token à notre API
//   const isApiCall = req.url.startsWith(environment.apiUrl);

//   const excludedPaths = [
//     '/api/auth/login',
//     '/api/auth/register',
//     '/auth/login',
//     '/auth/register',
//   ];

//   const isExcluded = excludedPaths.some((p) => req.url.endsWith(p));

//   if (isApiCall && !isExcluded && token) {
//     const cloned = req.clone({
//       setHeaders: { Authorization: `Bearer ${token}` },
//     });
//     return next(cloned);
//   }

//   return next(req);
// };


import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('auth_token');
  const apiBase = environment.apiUrl;

  // Vérifie si c'est un appel API
  const isApiCall = req.url.startsWith(apiBase);

  // Ne pas ajouter le token uniquement sur les routes de login/register
  const isAuthRoute =
    req.url.includes('/auth/login') ||
    req.url.includes('/auth/admin/login') ||
    req.url.includes('/auth/register');

  if (isApiCall && token && !isAuthRoute) {
    const cloned = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
    return next(cloned);
  }

  return next(req);
};
