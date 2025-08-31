import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-service-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './service-layout.component.html',
  styleUrl: './service-layout.component.scss'
})
export class ServiceLayoutComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  isAuthenticated = false;
  private authSub?: Subscription;

  ngOnInit(): void {
    this.authSub = this.authService.isAuthenticated$.subscribe(status => {
      this.isAuthenticated = status;
    });
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
  }
}
