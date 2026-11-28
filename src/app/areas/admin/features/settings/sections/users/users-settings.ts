import {
  ChangeDetectionStrategy,
  Component,
  computed,
  EventEmitter,
  inject,
  OnInit,
  Output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, type Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { MessageService } from 'primeng/api';
import { MultiSelectModule } from 'primeng/multiselect';

import { Area } from '@services/areas/area';
import { Auth } from '@services/auth/auth';
import { SettingsApi } from '@services/settings/settings-api';
import { problemMessage } from '@services/settings/problem-detail';
import type { AreaResponse } from '@models/dto/areas/area';
import type { UserRoleValue, UserStatusValue, UserSummary } from '@models/dto/settings/settings';
import { RmsBadge, type RmsBadgeTone } from '@shared/ui/badge/badge';
import { RmsButton } from '@shared/ui/button/button';
import { RmsDialog } from '@shared/ui/dialog/dialog';
import { RmsEmptyState } from '@shared/ui/empty-state/empty-state';
import { RmsInput } from '@shared/ui/input/input';
import { RmsSection } from '@shared/ui/section/section';
import { RmsSelect, type RmsSelectOption } from '@shared/ui/select/select';
import { RmsSkeleton } from '@shared/ui/skeleton/skeleton';
import { RmsStatusPill } from '@shared/ui/status-pill/status-pill';

type RoleFilter = 'ALL' | UserRoleValue;
type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
type EditableStatus = 'ACTIVE' | 'INACTIVE';

const ROLE_OPTIONS: RmsSelectOption[] = [
  { label: 'Administrador', value: 'ADMIN' },
  { label: 'Trabajador', value: 'WORKER' },
];

const STATUS_OPTIONS: RmsSelectOption[] = [
  { label: 'Activo', value: 'ACTIVE' },
  { label: 'Inactivo', value: 'INACTIVE' },
];

const ROLE_FILTER_OPTIONS: RmsSelectOption[] = [
  { label: 'Todos los roles', value: 'ALL' },
  ...ROLE_OPTIONS,
];

const STATUS_FILTER_OPTIONS: RmsSelectOption[] = [
  { label: 'Todos los estados', value: 'ALL' },
  ...STATUS_OPTIONS,
];

/**
 * Users and roles section.
 *
 * Contract: `GET /v1/users` plus `PATCH /v1/users/{id}/{role|areas|status}`.
 * The screen never handles passwords. Destructive changes (demoting an admin or
 * deactivating an account) require an explicit confirmation, the current admin's
 * own role/status controls are disabled, and every problem response is surfaced
 * verbatim instead of being swallowed.
 */
@Component({
  selector: 'app-settings-users',
  templateUrl: './users-settings.html',
  imports: [
    FormsModule,
    MultiSelectModule,
    RmsSection,
    RmsInput,
    RmsSelect,
    RmsButton,
    RmsDialog,
    RmsEmptyState,
    RmsSkeleton,
    RmsBadge,
    RmsStatusPill,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersSettingsSection implements OnInit {
  private readonly api = inject(SettingsApi);
  private readonly areasApi = inject(Area);
  private readonly auth = inject(Auth);
  private readonly messages = inject(MessageService);

  @Output() readonly dirtyChange = new EventEmitter<boolean>();

  readonly users = signal<UserSummary[]>([]);
  readonly areas = signal<AreaResponse[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly saving = signal(false);
  readonly dialogError = signal('');

  readonly search = signal('');
  readonly roleFilter = signal<RoleFilter>('ALL');
  readonly statusFilter = signal<StatusFilter>('ALL');

  readonly roleFilterOptions = ROLE_FILTER_OPTIONS;
  readonly statusFilterOptions = STATUS_FILTER_OPTIONS;
  readonly roleOptions = ROLE_OPTIONS;
  readonly statusOptions = STATUS_OPTIONS;

  readonly editVisible = signal(false);
  readonly confirmVisible = signal(false);
  readonly selectedUser = signal<UserSummary | null>(null);
  readonly roleDraft = signal<UserRoleValue>('WORKER');
  readonly statusDraft = signal<EditableStatus>('ACTIVE');
  readonly areaDraft = signal<number[]>([]);

  readonly currentUserId = computed(() => this.auth.getData()?.id ?? null);

  readonly filteredUsers = computed(() => {
    const term = this.search().trim().toLowerCase();
    const role = this.roleFilter();
    const status = this.statusFilter();

    return this.users().filter((user) => {
      const matchesTerm =
        term.length === 0 ||
        user.name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        user.document.toLowerCase().includes(term);
      const matchesRole = role === 'ALL' || user.role === role;
      const matchesStatus =
        status === 'ALL' ||
        (status === 'ACTIVE' ? user.status === 'ACTIVE' : user.status !== 'ACTIVE');
      return matchesTerm && matchesRole && matchesStatus;
    });
  });

  /** True when the current draft would demote an admin or deactivate an account. */
  readonly destructiveChange = computed(() => {
    const user = this.selectedUser();
    if (user === null) return false;
    const demotesAdmin = user.role === 'ADMIN' && this.roleDraft() === 'WORKER';
    const deactivates = user.status === 'ACTIVE' && this.statusDraft() === 'INACTIVE';
    return demotesAdmin || deactivates;
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    forkJoin({
      users: this.api.listUsers(),
      areas: this.areasApi.getAreas().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ users, areas }) => {
        this.users.set(users);
        this.areas.set(areas);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loadError.set(problemMessage(error, 'No se pudo cargar la lista de usuarios.'));
        this.loading.set(false);
      },
    });
  }

  openEdit(user: UserSummary): void {
    this.selectedUser.set(user);
    this.roleDraft.set(user.role);
    // The status PATCH only accepts ACTIVE/INACTIVE. A PENDING/ERROR account
    // defaults to ACTIVE so a role or area edit never deactivates it silently.
    this.statusDraft.set(user.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE');
    this.areaDraft.set([...user.areaIds]);
    this.dialogError.set('');
    this.confirmVisible.set(false);
    this.editVisible.set(true);
  }

  closeEdit(): void {
    this.editVisible.set(false);
    this.confirmVisible.set(false);
    this.selectedUser.set(null);
  }

  onRoleChange(value: string | number | null): void {
    if (value === 'ADMIN' || value === 'WORKER') this.roleDraft.set(value);
  }

  onStatusChange(value: string | number | null): void {
    if (value === 'ACTIVE' || value === 'INACTIVE') this.statusDraft.set(value);
  }

  /** Keeps an exclusive area alone as soon as the admin selects it. */
  onAreasChange(areaIds: number[] | null): void {
    const ids = areaIds ?? [];
    const exclusive = this.areas().find((area) => area.exclusive && ids.includes(area.id));
    this.areaDraft.set(exclusive === undefined ? ids : [exclusive.id]);
  }

  onRoleFilterChange(value: string | number | null): void {
    if (value === 'ALL' || value === 'ADMIN' || value === 'WORKER') {
      this.roleFilter.set(value);
    }
  }

  onStatusFilterChange(value: string | number | null): void {
    if (value === 'ALL' || value === 'ACTIVE' || value === 'INACTIVE') {
      this.statusFilter.set(value);
    }
  }

  /** Entry point of the dialog's save action. */
  requestSave(): void {
    if (this.saving()) return;
    if (this.destructiveChange()) {
      this.confirmVisible.set(true);
      return;
    }
    this.commit();
  }

  /** Commits the pending changes after the confirmation was accepted. */
  confirmSave(): void {
    this.confirmVisible.set(false);
    this.commit();
  }

  isSelf(user: UserSummary | null): boolean {
    return user !== null && user.id === this.currentUserId();
  }

  /** The status PATCH only accepts ACTIVE/INACTIVE; PENDING/ERROR are observations. */
  statusNeedsPromotion(user: UserSummary): boolean {
    return user.status !== 'ACTIVE' && user.status !== 'INACTIVE';
  }

  roleLabel(role: UserRoleValue): string {
    return role === 'ADMIN' ? 'Administrador' : 'Trabajador';
  }

  statusLabel(status: UserStatusValue): string {
    switch (status) {
      case 'ACTIVE':
        return 'Activo';
      case 'INACTIVE':
        return 'Inactivo';
      case 'PENDING':
        return 'Pendiente';
      case 'ERROR':
        return 'Error de activación';
    }
  }

  statusTone(status: UserStatusValue): 'success' | 'warning' | 'danger' | 'neutral' {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'PENDING':
        return 'warning';
      case 'ERROR':
        return 'danger';
      case 'INACTIVE':
        return 'neutral';
    }
  }

  roleTone(role: UserRoleValue): RmsBadgeTone {
    return role === 'ADMIN' ? 'brand' : 'neutral';
  }

  areaNames(user: UserSummary): string {
    if (user.areaIds.length === 0) return 'Sin área';
    const byId = new Map(this.areas().map((area) => [area.id, area.name]));
    return user.areaIds.map((id) => byId.get(id) ?? `Área ${String(id)}`).join(', ');
  }

  clearFilters(): void {
    this.search.set('');
    this.roleFilter.set('ALL');
    this.statusFilter.set('ALL');
  }

  private commit(): void {
    const user = this.selectedUser();
    if (user === null) return;

    const role = this.roleDraft();
    const status = this.statusDraft();
    const areaIds = [...this.areaDraft()].sort((a, b) => a - b);
    const currentAreas = [...user.areaIds].sort((a, b) => a - b);

    const requests: { label: string; request: Observable<UserSummary> }[] = [];
    if (role !== user.role) {
      requests.push({
        label: 'rol',
        request: this.api.updateUserRole(user.id, role),
      });
    }
    if (!sameIds(areaIds, currentAreas)) {
      requests.push({
        label: 'áreas',
        request: this.api.updateUserAreas(user.id, areaIds),
      });
    }
    if (user.status !== 'ACTIVE' && user.status !== 'INACTIVE') {
      requests.push({
        label: 'estado',
        request: this.api.updateUserStatus(user.id, status),
      });
    } else if (status !== user.status) {
      requests.push({
        label: 'estado',
        request: this.api.updateUserStatus(user.id, status),
      });
    }

    if (requests.length === 0) {
      this.messages.add({
        severity: 'info',
        summary: 'Sin cambios',
        detail: 'No modificaste el rol, las áreas ni el estado.',
        life: 3000,
      });
      this.closeEdit();
      return;
    }

    this.saving.set(true);
    this.dialogError.set('');

    let firstError = '';
    const guarded = requests.map(({ request }) =>
      request.pipe(
        catchError((error: unknown) => {
          if (firstError.length === 0) firstError = problemMessage(error);
          return of(null);
        }),
      ),
    );

    forkJoin(guarded).subscribe({
      next: () => {
        this.saving.set(false);
        if (firstError.length > 0) {
          this.dialogError.set(firstError);
          this.load();
          return;
        }
        this.closeEdit();
        this.load();
        this.messages.add({
          severity: 'success',
          summary: 'Usuario actualizado',
          detail: `Se guardaron los cambios de ${user.name}.`,
          life: 4000,
        });
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.dialogError.set(problemMessage(error, 'No se pudo actualizar el usuario.'));
        this.load();
      },
    });
  }
}

/** Set equality for two ascending id arrays. */
function sameIds(left: number[], right: number[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}
