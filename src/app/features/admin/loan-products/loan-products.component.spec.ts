import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoanProductsComponent } from './loan-products.component';

describe('LoanProductsComponent', () => {
  let component: LoanProductsComponent;
  let fixture: ComponentFixture<LoanProductsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoanProductsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(LoanProductsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
