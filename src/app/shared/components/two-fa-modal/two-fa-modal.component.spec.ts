import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TwoFaModalComponent } from './two-fa-modal.component';

describe('TwoFaModalComponent', () => {
  let component: TwoFaModalComponent;
  let fixture: ComponentFixture<TwoFaModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TwoFaModalComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(TwoFaModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
