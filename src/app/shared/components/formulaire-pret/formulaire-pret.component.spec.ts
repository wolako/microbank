import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FormulairePretComponent } from './formulaire-pret.component';

describe('FormulairePretComponent', () => {
  let component: FormulairePretComponent;
  let fixture: ComponentFixture<FormulairePretComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormulairePretComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(FormulairePretComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
