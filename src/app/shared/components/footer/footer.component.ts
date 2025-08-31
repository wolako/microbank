import { CommonModule, NgClass } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../../core/services/themes/theme.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterLink, NgClass],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent implements OnInit, OnDestroy {
  currentYear = new Date().getFullYear();
  isDarkMode = false;
  private subscriptions = new Subscription();

  constructor(private themeService: ThemeService) {}

  ngOnInit(): void {
    const themeSub = this.themeService.darkMode$.subscribe(mode => {
      this.isDarkMode = mode;
    });
    this.subscriptions.add(themeSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
