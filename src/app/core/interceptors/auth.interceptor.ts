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

  let headers: any = {};
  let withCredentials = true; // inclut les cookies si besoin

  const isApiCall = req.url.startsWith(environment.apiUrl);
  const isAuthRoute =
    req.url.includes('/auth/login') ||
    req.url.includes('/auth/admin/login') ||
    req.url.includes('/auth/register');

  if (isApiCall && token && !isAuthRoute) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const cloned = req.clone({
    setHeaders: headers,
    withCredentials: withCredentials
  });

  return next(cloned);
};

