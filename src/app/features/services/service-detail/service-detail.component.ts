import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ServiceService, BankService } from '../../../core/services/servicebank/service.service';
import { ServiceLayoutComponent } from '../service-layout/service-layout.component';
import { AuthService } from '../../../core/services/auth/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-service-detail',
  standalone: true,
  imports: [CommonModule, ServiceLayoutComponent, RouterLink],
  templateUrl: './service-detail.component.html',
  styleUrl: './service-detail.component.scss'
})
export class ServiceDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private serviceService = inject(ServiceService);
  private authService = inject(AuthService);
  private router = inject(Router);

  service: BankService | undefined;
  isAuthenticated = false;
  private authSub?: Subscription;

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.service = this.serviceService.getServiceById(id);
      }
    });

    // Écoute réactive de l'état d'authentification
    this.authSub = this.authService.isAuthenticated$.subscribe(status => {
      this.isAuthenticated = status;
    });
  }

  goToLoanForm(): void {
    if (!this.service) return;

    // Sécurise l'accès au formulaire : redirige vers login si non connecté
    if (!this.isAuthenticated) {
      this.router.navigate(['/login'], {
        queryParams: { returnUrl: `/loans/apply/${this.service.id}` }
      });
      return;
    }

    this.router.navigate(['/loans/apply', this.service.id]);
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
  }
}
