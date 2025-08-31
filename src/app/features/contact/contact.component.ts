import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ContactService } from '../../core/services/contact/contact.service';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.scss'
})
export class ContactComponent {
  contactForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    subject: ['', [Validators.required]],
    message: ['', [Validators.required, Validators.minLength(20)]]
  });
  
  isSubmitted = false;
  isLoading = false;

  constructor(
    private fb: FormBuilder,
    private contactService: ContactService
  ) {}

  onSubmit() {
    if (this.contactForm.invalid) return;

    this.isLoading = true;
    this.contactService.sendContactForm(this.contactForm.value).subscribe({
      next: () => {
        this.isSubmitted = true;
        this.contactForm.reset();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }
}
