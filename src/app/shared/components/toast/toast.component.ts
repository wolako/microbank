import { Component, OnInit } from '@angular/core';
import { ToastMessage, ToastService } from '../../../core/services/toast/toast.service';
import { CommonModule, NgClass } from '@angular/common';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [ CommonModule, NgClass ],
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.scss'
})
export class ToastComponent implements OnInit{
  toasts: ToastMessage[] = [];

  constructor(private toastService: ToastService) {}

  ngOnInit() {
    this.toastService.toast$.subscribe(toast => {
      this.toasts.push(toast);
      setTimeout(() => {
        this.toasts = this.toasts.filter(t => t !== toast);
      }, 3000);
    });
  }
}
