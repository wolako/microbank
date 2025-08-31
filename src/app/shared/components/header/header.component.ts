import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ThemeService } from '../../../core/services/themes/theme.service';
import { AsyncPipe, NgIf, NgFor } from '@angular/common';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, AsyncPipe, NgIf, NgFor],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
  isMenuCollapsed = true;
  isDarkMode = false;

  readonly navLinks = [
    { path: '/', label: 'Accueil', exact: true },
    { path: '/', fragment: 'loans', label: 'Prêts', exact: true },
    { path: '/contact', label: 'Contact', exact: false }
  ];

  constructor(
    public authService: AuthService,
    private router: Router,
    private themeService: ThemeService
  ) {
    this.themeService.darkMode$.subscribe(mode => {
      this.isDarkMode = mode;
    });
  }

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  scrollToLoans() {
    if (this.router.url === '/' || this.router.url.startsWith('/#')) {
      this.scrollToElement();
    } else {
      this.router.navigate(['/']).then(() => {
        setTimeout(() => this.scrollToElement(), 100);
      });
    }
    this.onLinkClick(); // Ferme le menu après scroll
  }

  private scrollToElement() {
    const element = document.getElementById('loans');
    if (element) element.scrollIntoView({ behavior: 'smooth' });
  }

  navigateTo(route: string): void {
    this.router.navigate([route]).then(() => this.onLinkClick()); // Ferme le menu après navigation
  }

  logout(): void {
    this.authService.logout();
    this.onLinkClick(); // Ferme le menu après déconnexion
  }

  isActive(path: string, exact: boolean = false): boolean {
    return this.router.isActive(path, exact);
  }

  /** Ferme le menu mobile si ouvert */
  onLinkClick(): void {
    if (!this.isMenuCollapsed) {
      this.isMenuCollapsed = true;
    }
  }
}
