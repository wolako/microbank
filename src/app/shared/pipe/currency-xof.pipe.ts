import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'currencyXof',
  standalone: true
})
export class CurrencyXofPipe implements PipeTransform {
  transform(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === '') {
      return '0 F CFA'; // espace insécable
    }

    const numericValue = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(numericValue)) {
      return '0 F CFA';
    }

    const formatted = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.floor(numericValue));

    return `${formatted} F CFA`;
  }
}
