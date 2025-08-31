import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AtmCodeModalComponent } from './atm-code-modal.component';

describe('AtmCodeModalComponent', () => {
  let component: AtmCodeModalComponent;
  let fixture: ComponentFixture<AtmCodeModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AtmCodeModalComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AtmCodeModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
