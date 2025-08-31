import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ServiceLayoutComponent } from './service-layout.component';

describe('ServiceLayoutComponent', () => {
  let component: ServiceLayoutComponent;
  let fixture: ComponentFixture<ServiceLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ServiceLayoutComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ServiceLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
