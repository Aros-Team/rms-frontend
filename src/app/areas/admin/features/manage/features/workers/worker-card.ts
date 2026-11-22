import { Component, computed, input, output } from '@angular/core';
import { RouterModule } from '@angular/router';
import { WorkerResponse } from '@app/shared/models/dto/workers/worker-response';
import { AreaResponse } from '@app/shared/models/dto/areas/area';
import { RmsBadge } from '@app/shared/ui/badge/badge';
import { RmsCard } from '@app/shared/ui/card/card';
import { RmsIconButton } from '@app/shared/ui/icon-button/icon-button';
import { RmsStatusPill } from '@app/shared/ui/status-pill/status-pill';

@Component({
  selector: 'app-worker-card',
  imports: [RouterModule, RmsBadge, RmsCard, RmsIconButton, RmsStatusPill],
  templateUrl: './worker-card.html',
})
export class WorkerCard {
  readonly worker = input.required<WorkerResponse>();
  readonly areas = input<AreaResponse[]>([]);
  readonly assignedScheduleCount = input<number>(0);

  readonly assignSchedule = output();
  readonly edit = output();
  readonly retryEmail = output();
  readonly delete = output();

  initials = computed(() => {
    const name = this.worker().name || '';
    const parts = name.split(' ').filter(p => p.length > 0);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase() || '??';
  });

  areaName = computed(() => {
    const areaId = this.worker().assignedAreas?.[0];
    if (areaId == null) return 'Sin área';
    const area = this.areas().find(a => a.id === areaId);
    return area?.name ?? 'Sin área';
  });

  statusLabel = computed(() => {
    switch (this.worker().status) {
      case 'PENDING': return 'Pendiente';
      case 'ERROR': return 'Error';
      case 'ACTIVE': return 'Activo';
      case 'INACTIVE': return 'Inactivo';
      default: return this.worker().status ?? 'Desconocido';
    }
  });

  statusTone = computed<'success' | 'warning' | 'danger' | 'neutral'>(() => {
    switch (this.worker().status) {
      case 'PENDING': return 'warning';
      case 'ERROR': return 'danger';
      case 'ACTIVE': return 'success';
      case 'INACTIVE': return 'neutral';
      default: return 'neutral';
    }
  });

  onAssignSchedule(): void {
    this.assignSchedule.emit();
  }

  onEdit(): void {
    this.edit.emit();
  }

  onRetryEmail(): void {
    this.retryEmail.emit();
  }

  onDelete(): void {
    this.delete.emit();
  }
}
