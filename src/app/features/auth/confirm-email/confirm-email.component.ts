import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { catchError, of, retry } from 'rxjs';

@Component({
  selector: 'app-confirm-email',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './confirm-email.component.html',
  styleUrl: './confirm-email.component.scss'
})
export class ConfirmEmailComponent implements OnInit {
  success = false;
  isLoading = true;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      console.error('Token manquant dans l\'URL');
      this.isLoading = false;
      return;
    }

    const encodedToken = encodeURIComponent(token);
    const params = new HttpParams().set('token', encodedToken);

    this.http.get(`${environment.apiUrl}/auth/confirm-email`, { params })
      .pipe(
        retry(2),
        catchError(err => {
          console.error('Erreur HTTP:', err);
          return of({ success: false });
        })
      )
      .subscribe((response: any) => {
        this.success = response?.success ?? false;
        this.isLoading = false;

        if (this.success) {
          // Appel du profil utilisateur pour vérifier is_approved
          this.http.get(`${environment.apiUrl}/auth/profile`)
            .subscribe(
              (user: any) => {
                const redirectTo = user?.is_approved
                  ? 'login'
                  : '/auth/pending-approval';

                setTimeout(() => {
                  this.router.navigate([redirectTo], {
                    state: {
                      emailVerified: true,
                      message: 'Votre email a été confirmé avec succès'
                    }
                  });
                }, 3000);
              },
              (err) => {
                console.error('Erreur récupération profil:', err);
                this.router.navigate(['login']);
              }
            );
        }
      });
  }
}
