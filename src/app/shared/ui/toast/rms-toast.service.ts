import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { RmsToast } from './rms-toast.types';

@Injectable({
  providedIn: 'root',
})
export class RmsToastService {
  private readonly messageService = inject(MessageService);

  show(toast: RmsToast): void {
    this.messageService.add({
      severity: toast.severity,
      summary: toast.summary,
      detail: toast.detail,
      life: toast.life || 3000,
      closable: toast.closable ?? true,
    });
  }

  success(summary: string, detail?: string, life?: number): void {
    this.show({ severity: 'success', summary, detail, life });
  }

  info(summary: string, detail?: string, life?: number): void {
    this.show({ severity: 'info', summary, detail, life });
  }

  warn(summary: string, detail?: string, life?: number): void {
    this.show({ severity: 'warn', summary, detail, life });
  }

  error(summary: string, detail?: string, life?: number): void {
    this.show({ severity: 'error', summary, detail, life });
  }

  clear(): void {
    this.messageService.clear();
  }
}
