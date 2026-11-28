import { Component, inject, computed } from '@angular/core';
import { Router } from '@angular/router';

import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';

import { TableSkeleton } from '@shared/skeletons/table-skeleton/table-skeleton';
import { Money } from '@shared/pipes/money/money';
import { RmsButton } from '@app/shared/ui/button/button';
import { RmsEmptyState } from '@app/shared/ui/empty-state/empty-state';
import { RmsIconButton } from '@app/shared/ui/icon-button/icon-button';
import { RmsPageHeader } from '@app/shared/ui/page-header/page-header';
import { RmsStatusPill } from '@app/shared/ui/status-pill/status-pill';
import { SpecialSelectionsCache } from '@app/core/services/special-selections/special-selections-cache';
import { SpecialSelectionResponse } from '@app/shared/models/dto/special-selections/special-selection-response';

@Component({
  selector: 'app-combos',
  imports: [
    Money,
    TableModule,
    ToastModule,
    SkeletonModule,
    TableSkeleton,
    RmsButton,
    RmsEmptyState,
    RmsIconButton,
    RmsPageHeader,
    RmsStatusPill,
  ],
  providers: [MessageService],
  templateUrl: './combos.html',
  styleUrl: './combos.css',
})
export class Combos {
  readonly cache = inject(SpecialSelectionsCache);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);

  combos = computed(() => this.cache.list.data() ?? []);
  isLoading = computed(() => this.cache.list.isLoading());

  constructor() {
    this.cache.list.load();
  }

  scheduleSummary(schedule: SpecialSelectionResponse['schedule']): string {
    const dayNames: Record<string, string> = {
      MONDAY: 'Lun',
      TUESDAY: 'Mar',
      WEDNESDAY: 'Mié',
      THURSDAY: 'Jue',
      FRIDAY: 'Vie',
      SATURDAY: 'Sáb',
      SUNDAY: 'Dom',
    };
    const grouped = new Map<string, string[]>();
    for (const entry of schedule) {
      const key = `${entry.startTime}-${entry.endTime}`;
      const list = grouped.get(key);
      if (list) {
        list.push(dayNames[entry.dayOfWeek] ?? entry.dayOfWeek);
      } else {
        grouped.set(key, [dayNames[entry.dayOfWeek] ?? entry.dayOfWeek]);
      }
    }
    return Array.from(grouped.entries())
      .map(([time, days]) => {
        const sortedDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].filter((d) =>
          days.includes(d),
        );
        const range =
          sortedDays.length > 1
            ? `${sortedDays[0]}-${sortedDays[sortedDays.length - 1]}`
            : (sortedDays[0] ?? days[0]);
        return `${range} ${time}`;
      })
      .join(', ');
  }

  navigateToNew(): void {
    void this.router.navigate(['/admin/manage/combos', 'new']);
  }

  navigateToEdit(id: number): void {
    void this.router.navigate(['/admin/manage/combos', id, 'edit']);
  }

  navigateToHistory(id: number): void {
    void this.router.navigate(['/admin/manage/combos', id, 'history']);
  }

  suggestPrice(): void {
    // Placeholder — wiring deferred until price suggestion dialog is built (task 10b)
    this.messageService.add({
      severity: 'info',
      summary: 'Precio sugerido',
      detail: 'Funcionalidad en construcción',
    });
  }
}
