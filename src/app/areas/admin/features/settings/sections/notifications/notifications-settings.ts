import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  inject,
  OnInit,
  Output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { MessageService } from 'primeng/api';

import { SettingsApi } from '@services/settings/settings-api';
import { problemMessage } from '@services/settings/problem-detail';
import type { NotificationSettings } from '@models/dto/settings/settings';
import { RmsButton } from '@shared/ui/button/button';
import { RmsEmptyState } from '@shared/ui/empty-state/empty-state';
import { RmsSection } from '@shared/ui/section/section';
import { RmsSkeleton } from '@shared/ui/skeleton/skeleton';
import { RmsSwitch } from '@shared/ui/switch/switch';

type NotificationForm = FormGroup<{
  kitchenSoundEnabled: FormControl<boolean>;
  kitchenHapticsEnabled: FormControl<boolean>;
  lowStockAlertsEnabled: FormControl<boolean>;
  orderAlertsEnabled: FormControl<boolean>;
  dailySummaryEnabled: FormControl<boolean>;
}>;

/**
 * Notification preferences section.
 *
 * Contract: `GET/PUT /v1/settings/notifications`. Preferences are global for
 * the restaurant (there is no per-user notification storage yet), which the
 * copy states explicitly so an admin does not expect a personal setting.
 */
@Component({
  selector: 'app-settings-notifications',
  templateUrl: './notifications-settings.html',
  imports: [ReactiveFormsModule, RmsSection, RmsSwitch, RmsButton, RmsEmptyState, RmsSkeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsSettingsSection implements OnInit {
  private readonly api = inject(SettingsApi);
  private readonly fb = inject(FormBuilder);
  private readonly messages = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  @Output() readonly dirtyChange = new EventEmitter<boolean>();

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly loadError = signal('');
  readonly saveError = signal('');
  readonly dirty = signal(false);

  readonly form: NotificationForm = this.fb.nonNullable.group({
    kitchenSoundEnabled: [true],
    kitchenHapticsEnabled: [false],
    lowStockAlertsEnabled: [true],
    orderAlertsEnabled: [true],
    dailySummaryEnabled: [false],
  });

  private snapshot = '';

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.refreshDirty();
    });
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.api.getNotifications().subscribe({
      next: (settings) => {
        this.patch(settings);
      },
      error: (error: unknown) => {
        this.loadError.set(
          problemMessage(error, 'No se pudieron cargar las preferencias de notificaciones.'),
        );
        this.loading.set(false);
      },
    });
  }

  reset(): void {
    if (this.snapshot.length === 0) return;
    this.patch(JSON.parse(this.snapshot) as NotificationSettings);
    this.saveError.set('');
  }

  save(): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.saveError.set('');
    this.api.updateNotifications(this.form.getRawValue()).subscribe({
      next: (settings) => {
        this.patch(settings);
        this.messages.add({
          severity: 'success',
          summary: 'Notificaciones guardadas',
          detail: 'Las preferencias globales se actualizaron.',
          life: 4000,
        });
      },
      error: (error: unknown) => {
        this.saveError.set(problemMessage(error, 'No se pudieron guardar las notificaciones.'));
        this.saving.set(false);
      },
    });
  }

  private patch(settings: NotificationSettings): void {
    this.form.reset(settings);
    this.snapshot = JSON.stringify(settings);
    this.loading.set(false);
    this.saving.set(false);
    this.refreshDirty();
  }

  private refreshDirty(): void {
    if (this.snapshot.length === 0) return;
    const dirty = JSON.stringify(this.form.getRawValue()) !== this.snapshot;
    this.dirty.set(dirty);
    this.dirtyChange.emit(dirty);
  }
}
