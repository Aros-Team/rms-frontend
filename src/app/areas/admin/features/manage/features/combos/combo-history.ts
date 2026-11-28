import { Component, inject, computed, effect, signal, input } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe, JsonPipe } from '@angular/common';

import { MessageService, ConfirmationService } from 'primeng/api';

import { RmsBadge } from '@app/shared/ui/badge/badge';
import { RmsButton } from '@app/shared/ui/button/button';
import { RmsEmptyState } from '@app/shared/ui/empty-state/empty-state';
import { RmsPageHeader } from '@app/shared/ui/page-header/page-header';
import { SpecialSelectionsCache } from '@app/core/services/special-selections/special-selections-cache';
import {
  parseHistorySnapshot,
  type SpecialSelectionHistoryEntry,
  type SpecialSelectionSnapshot,
} from '@app/shared/models/dto/special-selections/special-selection-history';
import type { ChangeType } from '@app/shared/models/dto/special-selections/special-selection-ws-payload';

/** History row plus the parsed snapshot for rendering. */
interface HistoryEntryView extends SpecialSelectionHistoryEntry {
  snapshot: SpecialSelectionSnapshot | null;
}

@Component({
  selector: 'app-combo-history',
  imports: [DatePipe, JsonPipe, RmsBadge, RmsButton, RmsEmptyState, RmsPageHeader],
  providers: [MessageService, ConfirmationService],
  templateUrl: './combo-history.html',
  styleUrl: './combo-history.css',
})
export class ComboHistory {
  private readonly cache = inject(SpecialSelectionsCache);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly router = inject(Router);

  readonly id = input.required<number>();

  private readonly historyRes = computed(() => this.cache.history(this.id()));
  private readonly historyPage = computed(() => this.historyRes().data());

  readonly entries = computed<HistoryEntryView[]>(() =>
    (this.historyPage()?.content ?? []).map((entry) => ({
      ...entry,
      snapshot: parseHistorySnapshot(entry),
    })),
  );
  readonly isLoading = computed(() => this.historyRes().isLoading());
  readonly expandedVersions = signal<Set<number>>(new Set());

  constructor() {
    effect(() => {
      this.historyRes().load();
    });
  }

  changeTypeLabel(type: ChangeType): string {
    const labels: Record<ChangeType, string> = {
      CREATE: 'Creación',
      UPDATE: 'Edición',
      SCHEDULE_CHANGE: 'Cambio de horario',
      PRICE_CHANGE: 'Cambio de precio',
      DELETE: 'Eliminación',
    };
    return labels[type];
  }

  changeTypeTone(type: ChangeType): 'info' | 'warning' | 'success' | 'danger' | 'neutral' {
    const tones: Record<ChangeType, 'info' | 'warning' | 'success' | 'danger' | 'neutral'> = {
      CREATE: 'info',
      UPDATE: 'warning',
      SCHEDULE_CHANGE: 'info',
      PRICE_CHANGE: 'info',
      DELETE: 'danger',
    };
    return tones[type];
  }

  toggleSnapshot(version: number): void {
    this.expandedVersions.update((s) => {
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
        this.cache.revert(this.id(), entry.version).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Combo restaurado a versión anterior',
            });
            this.historyRes().refresh();
          },
          error: () => {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'No se pudo revertir la versión',
            });
          },
        });
      },
    });
  }

  goBack(): void {
    void this.router.navigate(['/admin/manage/combos']);
  }
}
