import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { ScheduleAssignment } from '@app/core/services/schedules/schedule-assignment';
import { Schedule } from '@app/core/services/schedules/schedule';
import { Worker } from '@app/core/services/workers/worker';
import { Logging } from '@app/core/services/logging/logging';
import { WorkerResponse } from '@app/shared/models/dto/workers/worker-response.model';

import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { TableSkeleton } from '@shared/skeletons/table-skeleton';

@Component({
  selector: 'app-schedule-assignments',
  imports: [
    RouterModule,
    ButtonModule, TableModule, ToastModule, TagModule, SkeletonModule,
    TableSkeleton,
  ],
  providers: [MessageService],
  templateUrl: './schedule-assignments.html',
  styleUrl: './schedule-assignments.css',
})
export class ScheduleAssignments implements OnInit {
  private route = inject(ActivatedRoute);
  private scheduleAssignmentService = inject(ScheduleAssignment);
  private scheduleService = inject(Schedule);
  private workerService = inject(Worker);
  private logger = inject(Logging);
  private messageService = inject(MessageService);

  scheduleId = signal<number>(0);
  scheduleName = signal<string>('');
  workers = signal<WorkerResponse[]>([]);
  assignedScheduleIds = signal<number[]>([]);
  loading = signal(true);
  assigning = signal<Set<number>>(new Set());

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('scheduleId');
    if (id) {
      this.scheduleId.set(Number(id));
      this.loadData();
    }
  }

  private loadData(): void {
    this.loading.set(true);

    // Load schedule name and workers in parallel
    this.scheduleService.getById(this.scheduleId()).subscribe({
      next: (schedule) => {
        this.scheduleName.set(schedule.name);
      },
      error: (err: HttpErrorResponse) => {
        this.logger.error('Failed to load schedule', err);
      },
    });

    this.workerService.getWorkers().subscribe({
      next: (workersData) => {
        this.workers.set(workersData);
        this.loadAssignments();
      },
      error: (err: HttpErrorResponse) => {
        this.logger.error('Failed to load workers', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar trabajadores' });
        this.loading.set(false);
      },
    });
  }

  private loadAssignments(): void {
    // For each worker, get their assigned schedule IDs
    const workersList = this.workers();
    const allAssignments = new Set<number>();
    let completed = 0;

    if (workersList.length === 0) {
      this.loading.set(false);
      return;
    }

    for (const worker of workersList) {
      const wid = worker.id;
      if (wid == null) continue;
      this.scheduleAssignmentService.getAssignments(wid).subscribe({
        next: (scheduleIds) => {
          if (scheduleIds.includes(this.scheduleId())) {
            allAssignments.add(wid);
          }
        },
        complete: () => {
          completed++;
          if (completed === workersList.length) {
            this.assignedScheduleIds.set(Array.from(allAssignments));
            this.loading.set(false);
          }
        },
      });
    }
  }

  isAssigned(workerId: number): boolean {
    return this.assignedScheduleIds().includes(workerId);
  }

  toggleAssignment(worker: WorkerResponse): void {
    const workerId = worker.id;
    if (workerId == null) return;
    const currentlyAssigned = this.isAssigned(workerId);

    if (currentlyAssigned) {
      this.removeAssignment(workerId);
    } else {
      this.addAssignment(workerId);
    }
  }

  private addAssignment(workerId: number): void {
    this.assigning.update(s => new Set(s).add(workerId));

    this.scheduleAssignmentService.assign(workerId, this.scheduleId()).subscribe({
      next: () => {
        const current = this.assignedScheduleIds();
        this.assignedScheduleIds.set([...current, workerId]);
        this.messageService.add({ severity: 'success', summary: 'Asignado', detail: 'Horario asignado correctamente' });
        this.assigning.update(s => { const n = new Set(s); n.delete(workerId); return n; });
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 409) {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'El horario se solapa con turnos existentes del trabajador' });
        } else {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al asignar horario' });
        }
        this.assigning.update(s => { const n = new Set(s); n.delete(workerId); return n; });
      },
    });
  }

  private removeAssignment(workerId: number): void {
    this.assigning.update(s => new Set(s).add(workerId));

    // NOTE: getAssignments returns schedule IDs, but removeAssignment expects an assignment ID.
    // Currently passing scheduleId as assignmentId as a simplification.
    // TODO: Update when backend provides a proper endpoint to fetch assignment IDs separately,
    // or when getAssignments returns assignment IDs instead of schedule IDs.
    this.scheduleAssignmentService.removeAssignment(workerId, this.scheduleId()).subscribe({
      next: () => {
        const current = this.assignedScheduleIds();
        this.assignedScheduleIds.set(current.filter(id => id !== workerId));
        this.messageService.add({ severity: 'success', summary: 'Desasignado', detail: 'Horario desasignado correctamente' });
        this.assigning.update(s => { const n = new Set(s); n.delete(workerId); return n; });
      },
      error: (err: HttpErrorResponse) => {
        this.logger.error('Failed to remove assignment', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al desasignar horario' });
        this.assigning.update(s => { const n = new Set(s); n.delete(workerId); return n; });
      },
    });
  }

  isAssigning(workerId: number): boolean {
    return this.assigning().has(workerId);
  }
}
