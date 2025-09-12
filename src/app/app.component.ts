import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from './core/services/auth/auth.service';
import { NgClass } from '@angular/common';
import { ToastComponent } from './shared/components/toast/toast.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NgClass, ToastComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    // 🔁 Recharge la session utilisateur si un token est présent
    const authSub = this.authService.ensureUserLoaded().subscribe({
      next: user => {
        console.log(user ? '✅ Session utilisateur rechargée' : 'ℹ️ Aucune session active', user);
      },
      error: err => {
        console.error('❌ Erreur lors du chargement de la session :', err);
      }
    });
    this.subscriptions.add(authSub);
  }

  ngOnDestroy(): void {
    // Nettoie toutes les souscriptions
    this.subscriptions.unsubscribe();
  }
}
