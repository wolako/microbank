import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { routes } from './app.routes';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { twoFactorInterceptor } from './core/interceptors/two-factor.interceptor';


export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withViewTransitions()),
    provideHttpClient(
      withInterceptors([
        authInterceptor,
        errorInterceptor,
        twoFactorInterceptor
      ])
    ),
    provideAnimations(),
    provideZoneChangeDetection({ eventCoalescing: true })
  ]
};
