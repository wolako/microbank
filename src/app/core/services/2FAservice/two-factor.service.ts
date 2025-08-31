// src/app/core/services/2FAservice/two-factor.service.ts
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TwoFactorService {
  // Optionnel : utilitaires de validation
  isValidTotp(code: string): boolean {
    return /^\d{6}$/.test(code);
  }
}
