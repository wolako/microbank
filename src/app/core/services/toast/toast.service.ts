import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';


export interface ToastMessage {
  type: 'success' | 'error' | 'info';
  text: string;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {

   private toastSubject = new Subject<ToastMessage>();
  toast$ = this.toastSubject.asObservable();

  show(type: ToastMessage['type'], text: string) {
    this.toastSubject.next({ type, text });
  }
}
