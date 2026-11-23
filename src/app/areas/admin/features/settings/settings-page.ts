import {
  ChangeDetectionStrategy,
  Component,
  computed,
  EventEmitter,
  HostListener,
  inject,
  Output,
  signal,
  effect,
  OnDestroy,
} from '@angular/core';

import { PageContext } from '@app/core/services/page-context/page-context';
import { RmsBadge } from '@shared/ui/badge/badge';
import { RmsButton } from '@shared/ui/button/button';
import { RmsDialog } from '@shared/ui/dialog/dialog';
import { RmsPageHeader } from '@shared/ui/page-header/page-header';

import { AccountSettingsSection } from './sections/account/account-settings';
import { AppearanceSettingsSection } from './sections/appearance/appearance-settings';
import { BusinessSettings } from './sections/business/business-settings';
import { CurrencySettingsSection } from './sections/currency/currency-settings';
import { LaborSettingsSection } from './sections/labor/labor-settings';
import { NotificationsSettingsSection } from './sections/notifications/notifications-settings';
import { OpeningHoursSettingsSection } from './sections/opening-hours/opening-hours-settings';
import { UsersSettingsSection } from './sections/users/users-settings';

export type SettingsSectionId =
  | 'business'
  | 'openingHours'
  | 'currency'
  | 'labor'
  | 'notifications'
  | 'users'
  | 'appearance'
  | 'account';

export interface SettingsSection {
  readonly id: SettingsSectionId;
  readonly label: string;
  readonly description: string;
  readonly icon: string;
  readonly devOnly?: boolean;
}

/** Sections in reading order: money, people, then the system. */
const SECTIONS: readonly SettingsSection[] = [
  {
    id: 'business',
    label: 'Negocio',
    description: 'Identidad, contacto y zona horaria',
    icon: 'pi pi-shop',
  },
  {
    id: 'openingHours',
    label: 'Horario de atención',
    description: 'Apertura por día y alertas de cobertura',
    icon: 'pi pi-clock',
  },
  {
    id: 'currency',
    label: 'Moneda',
    description: 'Código, símbolo y decimales',
    icon: 'pi pi-dollar',
  },
  {
    id: 'labor',
    label: 'Nómina',
    description: 'Modo de costo y tarifa por hora',
    icon: 'pi pi-briefcase',
  },
  {
    id: 'notifications',
    label: 'Notificaciones',
    description: 'Sonidos, vibración y alertas',
    icon: 'pi pi-bell',
  },
  {
    id: 'users',
    label: 'Usuarios y roles',
    description: 'Rol, áreas y estado de acceso',
    icon: 'pi pi-users',
  },
  {
    id: 'appearance',
    label: 'Apariencia',
    description: 'Tema, tamaño de texto y contraste',
    icon: 'pi pi-palette',
  },
  {
    id: 'account',
    label: 'Cuenta',
    description: 'Perfil, contraseña, privacidad y sesión',
    icon: 'pi pi-user',
  },
];

/**
 * Settings workspace (`/admin/settings`).
 *
 * One route, one tab per section. Sections mount on demand, so opening the
 * workspace issues one request instead of eight. Each section reports its dirty
 * state; the page confirms before discarding it on a section switch and exposes
 * the same promise to `settingsUnsavedChangesGuard` when the route changes.
 */
@Component({
  selector: 'app-settings-page',
  templateUrl: './settings-page.html',
  imports: [
    RmsPageHeader,
    RmsBadge,
    RmsButton,
    RmsDialog,
    BusinessSettings,
    CurrencySettingsSection,
    LaborSettingsSection,
    NotificationsSettingsSection,
    OpeningHoursSettingsSection,
    UsersSettingsSection,
    AppearanceSettingsSection,
    AccountSettingsSection,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage implements OnDestroy {
  private readonly pageContext = inject(PageContext);

  readonly sections: readonly SettingsSection[] = SECTIONS;

  readonly activeSection = signal<SettingsSectionId>('business');
  readonly activeSectionMeta = computed(
    () => this.sections.find((section) => section.id === this.activeSection()) ?? this.sections[0],
  );

  readonly dirtySections = signal<Partial<Record<SettingsSectionId, boolean>>>({});
  readonly hasUnsavedChanges = computed(() =>
    Object.values(this.dirtySections()).some((dirty) => dirty),
  );

  readonly confirmVisible = signal(false);

  /** Set when the confirmation was opened by a section switch, not by a route change. */
  private pendingSection: SettingsSectionId | null = null;
  private pendingResolve: ((discard: boolean) => void) | null = null;

  @Output() readonly dirtyChange = new EventEmitter<boolean>();

  constructor() {
    effect(() => {
      this.pageContext.set(this.activeSectionMeta().description);
    });
  }

  ngOnDestroy(): void {
    this.pageContext.clear();
  }

  markDirty(section: SettingsSectionId, dirty: boolean): void {
    const next = { ...this.dirtySections(), [section]: dirty };
    this.dirtySections.set(next);
    this.dirtyChange.emit(this.hasUnsavedChanges());
  }

  requestSection(id: SettingsSectionId): void {
    if (id === this.activeSection()) return;
    if (this.hasUnsavedChanges()) {
      this.pendingSection = id;
      void this.confirmDiscard().then((discard) => {
        this.pendingSection = null;
        if (discard) this.applySection(id);
      });
      return;
    }
    this.applySection(id);
  }

  /**
   * Resolves `true` when the admin accepts discarding local edits.
   *
   * Used both by the in-page section switch and by the route's `canDeactivate`
   * guard. When nothing is dirty it resolves immediately, so normal navigation
   * never sees a dialog.
   */
  confirmDiscard(): Promise<boolean> {
    if (!this.hasUnsavedChanges()) return Promise.resolve(true);
    this.confirmVisible.set(true);
    return new Promise<boolean>((resolve) => {
      this.pendingResolve = resolve;
    });
  }

  acceptDiscard(): void {
    this.dirtySections.set({});
    this.dirtyChange.emit(false);
    this.confirmVisible.set(false);
    this.resolvePending(true);
  }

  cancelDiscard(): void {
    this.confirmVisible.set(false);
    this.resolvePending(false);
    this.pendingSection = null;
  }

  onConfirmVisible(visible: boolean): void {
    if (!visible) this.cancelDiscard();
  }

  onTabKeydown(event: KeyboardEvent, index: number): void {
    let nextIndex: number;

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        nextIndex = (index + 1) % this.sections.length;
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        nextIndex = (index - 1 + this.sections.length) % this.sections.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = this.sections.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const target = this.sections[nextIndex];
    this.requestSection(target.id);
    document.getElementById(`settings-tab-${target.id}`)?.focus();
  }

  onTabClick(id: SettingsSectionId): void {
    this.requestSection(id);
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (!this.hasUnsavedChanges()) return;
    event.preventDefault();
  }

  private applySection(id: SettingsSectionId): void {
    this.activeSection.set(id);
  }

  private resolvePending(discard: boolean): void {
    const resolve = this.pendingResolve;
    this.pendingResolve = null;
    resolve?.(discard);
  }
}
