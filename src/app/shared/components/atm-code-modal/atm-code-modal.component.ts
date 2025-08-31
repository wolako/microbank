import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-atm-code-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './atm-code-modal.component.html',
  styleUrl: './atm-code-modal.component.scss'
})
export class AtmCodeModalComponent {
  @Input() visible = false;
  @Output() onConfirm = new EventEmitter<string>();
  @Output() onCancel = new EventEmitter<void>();
  code = '';
}
