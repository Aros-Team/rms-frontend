import { Component, OnInit, inject, signal } from '@angular/core';
import { WorkerSchedule } from '@app/core/services/schedules/worker-schedule';
import { Logging } from '@app/core/services/logging/logging';
import { WorkerScheduleResponse, WorkerScheduleDay } from '@app/shared/models/dto/schedules/worker-schedule-response.model';

import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';

const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};

@Component({
  selector: 'app-my-schedule',
  imports: [ButtonModule, SkeletonModule],
  templateUrl: './my-schedule.html',
  styleUrl: './my-schedule.css',
})
export class MySchedule implements OnInit {
  private workerScheduleService = inject(WorkerSchedule);
  private logger = inject(Logging);

  scheduleData = signal<WorkerScheduleResponse | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  DAY_LABELS = DAY_LABELS;

  ngOnInit(): void {
    this.loadSchedule();
  }

  loadSchedule(): void {
    this.loading.set(true);
    this.error.set(null);
    this.workerScheduleService.getMySchedule().subscribe({
      next: (data) => {
        this.scheduleData.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.logger.error('Failed to load schedule', err);
        this.error.set('Error al cargar tu horario');
        this.loading.set(false);
      },
    });
  }

  isToday(dayOfWeek: string): boolean {
    const dayMap: Record<string, number> = {
      MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4,
      FRIDAY: 5, SATURDAY: 6, SUNDAY: 0,
    };
    return dayMap[dayOfWeek] === new Date().getDay();
  }

  trackByDay(index: number, day: WorkerScheduleDay): string {
    return day.dayOfWeek;
  }
}
