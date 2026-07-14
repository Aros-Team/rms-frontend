import { Component, inject, computed, effect, signal, input } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe, JsonPipe } from '@angular/common';

import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';

import { SpecialSelectionsCacheService } from '@app/core/services/special-selections/special-selections-cache.service';
import type { SpecialSelectionHistoryEntry } from '@app/shared/models/dto/special-selections/special-selection-history';
import type { ChangeType } from '@app/shared/models/dto/special-selections/special-selection-ws-payload';

@Component({
  selector: 'app-combo-history',
  imports: [
    ButtonModule,
    TagModule,
    ToastModule,
    ConfirmDialogModule,
    DatePipe,
    JsonPipe,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './combo-history.html',
  styleUrl: './combo-history.css',
})
export class ComboHistory {
  private readonly cache = inject(SpecialSelectionsCacheService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly router = inject(Router);

  readonly comboId = input.required<number>();

  private readonly historyRes = computed(() => this.cache.history(this.comboId()));
  readonly entries = computed(() => this.historyRes().data()?.content ?? []);
  readonly isLoading = computed(() => this.historyRes().isLoading());
  readonly expandedVersions = signal<Set<number>>(new Set());

  constructor() {
    effect(() => { this.historyRes().load(); });
  }

  changeTypeLabel(type: ChangeType): string {
    const labels: Record<ChangeType, string> = {
      CREATE: 'Creación',
      UPDATE: 'Edición',
      SCHEDULE_CHANGE: 'Cambio de horario',
      PRICE_CHANGE: 'Cambio de precio',
      DELETE: 'Eliminación',
      REVERT: 'Reversión',
    };
    return labels[type];
  }

  changeTypeSeverity(type: ChangeType): 'info' | 'warn' | 'success' | 'danger' | 'contrast' | undefined {
    const sevs: Record<ChangeType, 'info' | 'warn' | 'success' | 'danger' | 'contrast'> = {
      CREATE: 'info',
      UPDATE: 'warn',
      SCHEDULE_CHANGE: 'info',
      PRICE_CHANGE: 'info',
      DELETE: 'danger',
      REVERT: 'success',
    };
    return sevs[type];
  }

  toggleSnapshot(version: number): void {
    this.expandedVersions.update(s => {
      const next = new Set(s);
      if (next.has(version)) next.delete(version);
      else next.add(version);
      return next;
    });
  }

  revert(entry: SpecialSelectionHistoryEntry): void {
    this.confirmationService.confirm({
      message: `¿Restaurar la versión #${String(entry.version)} del combo?`,
      header: 'Confirmar reversión',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.cache.revert(this.comboId(), entry.version).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Combo restaurado a versión anterior' });
            this.historyRes().refresh();
          },
          error: () => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo revertir la versión' });
          },
        });
      },
    });
  }

  goBack(): void {
    void this.router.navigate(['/admin/manage/combos']);
  }
}
