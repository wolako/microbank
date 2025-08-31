import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private darkMode = new BehaviorSubject<boolean>(false);
  darkMode$ = this.darkMode.asObservable();

  constructor() {
    const storedTheme = localStorage.getItem('darkMode');
    const isDark = storedTheme ? storedTheme === 'true' : false;
    this.darkMode.next(isDark);
    this.applyTheme(isDark);
  }

  toggleTheme() {
    const isDark = !this.darkMode.value;
    this.darkMode.next(isDark);
    localStorage.setItem('darkMode', String(isDark));
    this.applyTheme(isDark);
  }

  private applyTheme(isDark: boolean) {
    const body = document.body;

    if (isDark) {
      body.classList.add('dark-mode');
      body.classList.remove('light-mode');
    } else {
      body.classList.add('light-mode');
      body.classList.remove('dark-mode');
    }
  }
}
