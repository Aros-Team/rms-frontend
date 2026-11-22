import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormBuilder, FormGroup, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

import { MessageService } from 'primeng/api';

import { SettingsApi } from '@services/settings/settings-api';
import { problemMessage } from '@services/settings/problem-detail';
import type { ConfigEntry, ConfigGroup } from '@models/dto/settings/settings';
import { RmsButton } from '@shared/ui/button/button';
import { RmsCard } from '@shared/ui/card/card';
import { RmsDialog } from '@shared/ui/dialog/dialog';
import { RmsEmptyState } from '@shared/ui/empty-state/empty-state';
import { RmsInput } from '@shared/ui/input/input';
import { RmsSection } from '@shared/ui/section/section';
import { RmsSelect, type RmsSelectOption } from '@shared/ui/select/select';
import { RmsSkeleton } from '@shared/ui/skeleton/skeleton';
import { RmsTextarea } from '@shared/ui/textarea/textarea';

import { formatSettingsTimestamp, requiredValidator } from '../../settings-validation';

type GroupMode = 'create' | 'rename';
type EntryMode = 'create' | 'edit';

interface GroupForm {
  name: FormControl<string>;
  description: FormControl<string>;
  sortOrder: FormControl<string>;
}

interface EntryForm {
  key: FormControl<string>;
  value: FormControl<string>;
  description: FormControl<string>;
  groupId: FormControl<string>;
  sortOrder: FormControl<string>;
}

/**
 * Advanced configuration section (legacy `/v1/config`).
 *
 * Contract: list groups with entries, create/rename/delete groups, patch and
 * delete entries, and the bulk `PUT /config` upsert for new keys. Deleting a
 * non-empty group is blocked client-side and the server's `409` is surfaced if
 * it happens anyway (a concurrent insert). Every destructive action asks first.
 */
@Component({
  selector: 'app-settings-advanced',
  templateUrl: './advanced-settings.html',
  imports: [
    ReactiveFormsModule,
    RmsSection,
    RmsCard,
    RmsButton,
    RmsDialog,
    RmsInput,
    RmsTextarea,
    RmsSelect,
    RmsEmptyState,
    RmsSkeleton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdvancedSettingsSection implements OnInit {
  private readonly api = inject(SettingsApi);
  private readonly fb = inject(FormBuilder);
  private readonly messages = inject(MessageService);

  readonly groups = signal<ConfigGroup[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly saving = signal(false);
  readonly actionError = signal('');
  readonly dialogError = signal('');

  readonly groupMode = signal<GroupMode | null>(null);
  readonly groupTarget = signal<ConfigGroup | null>(null);
  readonly entryMode = signal<EntryMode | null>(null);
  readonly entryTarget = signal<ConfigEntry | null>(null);
  readonly confirmDeleteGroup = signal<ConfigGroup | null>(null);
  readonly confirmDeleteEntry = signal<ConfigEntry | null>(null);

  readonly groupForm: FormGroup<GroupForm> = this.fb.nonNullable.group({
    name: ['', [requiredValidator, Validators.maxLength(80)]],
    description: ['', [Validators.maxLength(200)]],
    sortOrder: ['0', [Validators.pattern(/^\d+$/)]],
  });

  readonly entryForm: FormGroup<EntryForm> = this.fb.nonNullable.group({
    key: ['', [requiredValidator, Validators.maxLength(120), Validators.pattern(/^[A-Za-z0-9_.-]+$/)]],
    value: ['', [requiredValidator, Validators.maxLength(500)]],
    description: ['', [Validators.maxLength(200)]],
    groupId: ['', [requiredValidator, Validators.pattern(/^\d+$/)]],
    sortOrder: ['0', [Validators.pattern(/^\d+$/)]],
  });

  readonly entryCount = signal(0);

  readonly groupOptions = computed<RmsSelectOption[]>(() =>
    this.groups().map((group) => ({ label: group.name, value: String(group.id) })),
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.api.getConfigGroups().subscribe({
      next: (groups) => {
        this.groups.set(groups);
        this.entryCount.set(groups.reduce((total, group) => total + group.entries.length, 0));
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loadError.set(
          problemMessage(error, 'No se pudo cargar la configuración avanzada.'),
        );
        this.loading.set(false);
      },
    });
  }

  openCreateGroup(): void {
    this.groupMode.set('create');
    this.groupTarget.set(null);
    this.dialogError.set('');
    this.groupForm.reset({ name: '', description: '', sortOrder: '0' });
  }

  openRenameGroup(group: ConfigGroup): void {
    this.groupMode.set('rename');
    this.groupTarget.set(group);
    this.dialogError.set('');
    this.groupForm.reset({
      name: group.name,
      description: group.description ?? '',
      sortOrder: String(group.sortOrder),
    });
  }

  submitGroup(): void {
    if (this.groupForm.invalid) {
      this.groupForm.markAllAsTouched();
      return;
    }
    if (this.saving()) return;

    const raw = this.groupForm.getRawValue();
    const body = {
      name: raw.name.trim(),
      description: raw.description.trim(),
      sortOrder: raw.sortOrder.trim().length > 0 ? Number(raw.sortOrder) : null,
    };

    const target = this.groupTarget();
    const creating = !(this.groupMode() === 'rename' && target !== null);
    const request =
      this.groupMode() === 'rename' && target !== null
        ? this.api.updateGroup(target.id, body)
        : this.api.createGroup(body);

    this.saving.set(true);
    this.dialogError.set('');
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.groupMode.set(null);
        this.load();
        this.messages.add({
          severity: 'success',
          summary: creating ? 'Grupo creado' : 'Grupo actualizado',
          detail: body.name,
          life: 4000,
        });
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.dialogError.set(problemMessage(error, 'No se pudo guardar el grupo.'));
      },
    });
  }

  openCreateEntry(group: ConfigGroup): void {
    this.entryMode.set('create');
    this.entryTarget.set(null);
    this.dialogError.set('');
    this.entryForm.reset({
      key: '',
      value: '',
      description: '',
      groupId: String(group.id),
      sortOrder: String(group.entries.length + 1),
    });
  }

  openEditEntry(entry: ConfigEntry): void {
    this.entryMode.set('edit');
    this.entryTarget.set(entry);
    this.dialogError.set('');
    this.entryForm.reset({
      key: entry.key,
      value: entry.value,
      description: entry.description ?? '',
      groupId: String(entry.groupId),
      sortOrder: String(entry.sortOrder),
    });
  }

  submitEntry(): void {
    if (this.entryForm.invalid) {
      this.entryForm.markAllAsTouched();
      return;
    }
    if (this.saving()) return;

    const raw = this.entryForm.getRawValue();
    const groupId = Number(raw.groupId);
    const sortOrder = raw.sortOrder.trim().length > 0 ? Number(raw.sortOrder) : null;
    const target = this.entryTarget();

    this.saving.set(true);
    this.dialogError.set('');

    if (this.entryMode() === 'edit' && target !== null) {
      this.api
        .updateEntry(target.key, {
          value: raw.value.trim(),
          description: raw.description.trim(),
          groupId,
          sortOrder,
        })
        .subscribe({
          next: () => {
            this.afterEntrySaved('Entrada actualizada', target.key);
          },
          error: (error: unknown) => {
            this.saving.set(false);
            this.dialogError.set(problemMessage(error, 'No se pudo actualizar la entrada.'));
          },
        });
      return;
    }

    this.api
      .upsertEntries([
        {
          key: raw.key.trim(),
          value: raw.value.trim(),
          groupId,
          sortOrder,
        },
      ])
      .subscribe({
        next: () => {
          this.afterEntrySaved('Entrada guardada', raw.key.trim());
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.dialogError.set(
            problemMessage(error, 'No se pudo guardar la entrada.'),
          );
        },
      });
  }

  askDeleteEntry(entry: ConfigEntry): void {
    this.actionError.set('');
    this.confirmDeleteEntry.set(entry);
  }

  askDeleteGroup(group: ConfigGroup): void {
    this.actionError.set('');
    this.confirmDeleteGroup.set(group);
  }

  confirmEntryDeletion(): void {
    const entry = this.confirmDeleteEntry();
    if (entry === null) return;
    this.saving.set(true);
    this.api.deleteEntry(entry.key).subscribe({
      next: () => {
        this.saving.set(false);
        this.confirmDeleteEntry.set(null);
        this.load();
        this.messages.add({
          severity: 'success',
          summary: 'Entrada eliminada',
          detail: entry.key,
          life: 4000,
        });
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.confirmDeleteEntry.set(null);
        this.actionError.set(problemMessage(error, 'No se pudo eliminar la entrada.'));
      },
    });
  }

  confirmGroupDeletion(): void {
    const group = this.confirmDeleteGroup();
    if (group === null) return;
    this.saving.set(true);
    this.api.deleteGroup(group.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.confirmDeleteGroup.set(null);
        this.load();
        this.messages.add({
          severity: 'success',
          summary: 'Grupo eliminado',
          detail: group.name,
          life: 4000,
        });
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.confirmDeleteGroup.set(null);
        this.actionError.set(problemMessage(error, 'No se pudo eliminar el grupo.'));
      },
    });
  }

  groupNameError(): string {
    const control = this.groupForm.controls.name;
    if (!control.invalid || !control.touched) return '';
    if (control.hasError('required')) return 'El nombre del grupo es obligatorio.';
    return 'Usa un nombre de hasta 80 caracteres.';
  }

  entryError(name: 'key' | 'value' | 'groupId' | 'sortOrder'): string {
    const control = this.entryForm.controls[name];
    if (!control.invalid || !control.touched) return '';
    if (control.hasError('required')) {
      return name === 'groupId' ? 'Selecciona un grupo.' : 'Este campo es obligatorio.';
    }
    if (control.hasError('pattern')) {
      return name === 'key'
        ? 'Usa letras, números, punto, guion o guion bajo.'
        : 'Usa solo números enteros.';
    }
    return 'Revisa este campo.';
  }

  formatTimestamp(iso: string | null): string {
    return formatSettingsTimestamp(iso);
  }

  onGroupDialogVisible(visible: boolean): void {
    if (!visible) this.groupMode.set(null);
  }

  onEntryDialogVisible(visible: boolean): void {
    if (!visible) this.entryMode.set(null);
  }

  onGroupConfirmVisible(visible: boolean): void {
    if (!visible) this.confirmDeleteGroup.set(null);
  }

  onEntryConfirmVisible(visible: boolean): void {
    if (!visible) this.confirmDeleteEntry.set(null);
  }

  private afterEntrySaved(summary: string, key: string): void {
    this.saving.set(false);
    this.entryMode.set(null);
    this.load();
    this.messages.add({
      severity: 'success',
      summary,
      detail: key,
      life: 4000,
    });
  }
}
