import { Component, computed, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { RouterModule } from '@angular/router';
import { UserResponse } from '@app/shared/models/dto/users/user-response.model';
import { AreaResponse } from '@app/shared/models/dto/areas/area.model';

@Component({
  selector: 'app-worker-card',
  imports: [ButtonModule, TagModule, TooltipModule, RouterModule],
  templateUrl: './worker-card.html',
  styles: ``,
})
export class WorkerCard {
  readonly user = input.required<UserResponse>();
  readonly areas = input<AreaResponse[]>([]);
  readonly assignedScheduleCount = input<number>(0);

  readonly assignSchedule = output();
  readonly edit = output();
  readonly retryEmail = output();

  avatarColor = computed(() => {
    const name = this.user().name || '';
    const colors = [
      '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
      '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  });

  initials = computed(() => {
    const name = this.user().name || '';
    const parts = name.split(' ').filter(p => p.length > 0);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase() || '??';
  });

  areaName = computed(() => {
    const areaId = this.user().assignedAreas?.[0];
    if (areaId == null) return 'Sin área';
    const area = this.areas().find(a => a.id === areaId);
    return area?.name ?? 'Sin área';
  });

  statusLabel = computed(() => {
    switch (this.user().status) {
      case 'PENDING': return 'Pendiente';
      case 'ERROR': return 'Error';
      case 'ACTIVE': return 'Activo';
      case 'INACTIVE': return 'Inactivo';
      default: return this.user().status ?? 'Desconocido';
    }
  });

  statusSeverity = computed<'warn' | 'danger' | 'success' | 'secondary'>(() => {
    switch (this.user().status) {
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
}
