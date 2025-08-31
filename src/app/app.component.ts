import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from './core/services/auth/auth.service';
import { ThemeService } from './core/services/themes/theme.service';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NgClass],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  isDarkMode = false;
  private subscriptions = new Subscription();

  constructor(
    private authService: AuthService,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    // 🔁 Recharge la session si un token est présent au démarrage
    const authSub = this.authService.ensureUserLoaded().subscribe({
      next: user => {
        if (user) {
          console.log('✅ Session utilisateur rechargée :', user);
        } else {
          console.log('ℹ️ Aucune session utilisateur active');
        }
      },
      error: err => {
        console.error('❌ Erreur lors du chargement de la session :', err);
      }
    });
    this.subscriptions.add(authSub);

    // 🎨 Abonnement au mode sombre/clair
    const themeSub = this.themeService.darkMode$.subscribe(mode => {
      this.isDarkMode = mode;
    });
    this.subscriptions.add(themeSub);
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  ngOnDestroy(): void {
    // Nettoie toutes les souscriptions pour éviter les fuites mémoire
    this.subscriptions.unsubscribe();
  }
}
