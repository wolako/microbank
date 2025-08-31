import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api/api.service';

@Component({
  selector: 'app-loan-products',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './loan-products.component.html',
  styleUrl: './loan-products.component.scss'
})
export class LoanProductsComponent {
  products: any[] = [];

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts() {
    this.api.get('admin/loan-products').subscribe({
      next: (res: any) => this.products = res,
      error: err => console.error(err)
    });
  }
}
