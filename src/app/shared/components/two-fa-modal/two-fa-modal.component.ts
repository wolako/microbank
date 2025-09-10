import { animate, style, transition, trigger } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-two-fa-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './two-fa-modal.component.html',
  styleUrls: ['./two-fa-modal.component.scss'],
  animations: [
    trigger('fade', [
      transition(':enter', [ style({ opacity: 0 }), animate('200ms ease-out', style({ opacity: 1 })) ]),
      transition(':leave', [ animate('200ms ease-in', style({ opacity: 0 })) ])
    ]),
    trigger('slide', [
      transition(':enter', [ style({ transform: 'translateY(-50px)', opacity: 0 }), animate('200ms ease-out', style({ transform: 'translateY(0)', opacity: 1 })) ]),
      transition(':leave', [ animate('200ms ease-in', style({ transform: 'translateY(-50px)', opacity: 0 })) ])
    ])
  ]
})
export class TwoFaModalComponent implements AfterViewInit, OnChanges {
  @Input() visible = false;
  @Input() message?: string;
  @Input() error?: string;
  @Output() onConfirm = new EventEmitter<string>();
  @Output() onCancel = new EventEmitter<void>();

  token: string = '';
  private tokenInputElement!: HTMLInputElement;

  ngAfterViewInit(): void {
    this.tokenInputElement = this.el.nativeElement.querySelector('input');
  }

  constructor(private el: ElementRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && changes['visible'].currentValue) {
      setTimeout(() => this.tokenInputElement?.focus(), 0);
    }
  }

  confirm() {
    if (!this.token) {
      this.error = 'Le code 2FA est requis.';
      return;
    }
    this.error = '';
    this.onConfirm.emit(this.token);
    this.token = '';
  }

  close() {
    this.token = '';
    this.error = '';
    this.onCancel.emit();
  }
}
