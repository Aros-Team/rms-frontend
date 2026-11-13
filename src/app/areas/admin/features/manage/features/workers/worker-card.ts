import { Component, computed, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { RouterModule } from '@angular/router';
import { WorkerResponse } from '@app/shared/models/dto/workers/worker-response';
import { AreaResponse } from '@app/shared/models/dto/areas/area';

@Component({
  selector: 'app-worker-card',
  imports: [ButtonModule, TagModule, TooltipModule, RouterModule],
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

  avatarColor = computed(() => {
    const name = this.worker().name || '';
    // 700-level shades: the avatar always renders white initials, and the
    // 500-level versions of amber/lime/cyan fail 4.5:1 against white.
    const colors = [
      '#2563EB', '#047857', '#B45309', '#B91C1C',
      '#6D28D9', '#BE185D', '#0E7490', '#4D7C0F',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  });

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

  statusSeverity = computed<'warn' | 'danger' | 'success' | 'secondary'>(() => {
    switch (this.worker().status) {
      case 'PENDING': return 'warn';
      case 'ERROR': return 'danger';
      case 'ACTIVE': return 'success';
      case 'INACTIVE': return 'secondary';
      default: return 'secondary';
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
