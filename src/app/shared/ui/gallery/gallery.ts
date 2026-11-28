import { ChangeDetectionStrategy, Component, isDevMode, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';

import { RmsBadge } from '../badge/badge';
import { RmsButton } from '../button/button';
import { RmsCard } from '../card/card';
import { RmsChartFrame } from '../chart-frame/chart-frame';
import { RmsCheckbox } from '../checkbox/checkbox';
import { RmsDialog } from '../dialog/dialog';
import { RmsEmptyState } from '../empty-state/empty-state';
import { RmsField } from '../field/field';
import { RmsIconButton } from '../icon-button/icon-button';
import { RmsInput } from '../input/input';
import { RmsPageHeader } from '../page-header/page-header';
import { RmsSection } from '../section/section';
import { RmsSelect, type RmsSelectOption } from '../select/select';
import { RmsSheet } from '../sheet/sheet';
import { RmsSkeleton } from '../skeleton/skeleton';
import { RmsStatTile } from '../stat-tile/stat-tile';
import { RmsStatusPill } from '../status-pill/status-pill';
import { RmsSwitch } from '../switch/switch';
import { RmsTextarea } from '../textarea/textarea';

interface TokenSwatch {
  token: string;
  note?: string;
}

interface TokenGroup {
  title: string;
  description: string;
  swatches: TokenSwatch[];
}

/**
 * Dev-only design-system gallery (P1-UI-16).
 *
 * Renders every token family, the type/spacing/radius/motion scales and every
 * primitive (including its states) so light, dark and high contrast can be
 * compared in one page.
 *
 * The route is owned by the Shell lane; add it only in development:
 *
 *   {
 *     path: 'dev/ui',
 *     canMatch: [() => isDevMode()],
 *     loadComponent: () =>
 *       import('./shared/ui/gallery/gallery').then((m) => m.UiGallery),
 *   }
 *
 * The component itself refuses to render outside dev mode.
 */
@Component({
  selector: 'app-ui-gallery',
  templateUrl: './gallery.html',
  styleUrl: './gallery.css',
  imports: [
    ButtonModule,
    InputTextModule,
    TagModule,
    RmsBadge,
    RmsButton,
    RmsCard,
    RmsChartFrame,
    RmsCheckbox,
    RmsDialog,
    RmsEmptyState,
    RmsField,
    RmsIconButton,
    RmsInput,
    RmsPageHeader,
    RmsSection,
    RmsSelect,
    RmsSheet,
    RmsSkeleton,
    RmsStatTile,
    RmsStatusPill,
    RmsSwitch,
    RmsTextarea,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiGallery {
  readonly isDev = isDevMode();

  readonly dark = signal(document.documentElement.classList.contains('dark'));
  readonly highContrast = signal(document.documentElement.getAttribute('data-contrast') === 'high');

  readonly dialogVisible = signal(false);
  readonly sheetOpen = signal(false);
  readonly sheetEnd = signal(false);

  readonly selectOptions: RmsSelectOption[] = [
    { label: 'Salón', value: 'FOH' },
    { label: 'Cocina', value: 'BOH' },
    { label: 'Barra', value: 'BAR' },
  ];

  readonly tokenGroups: TokenGroup[] = [
    {
      title: 'Escala neutra',
      description: 'Una sola familia de grises para tema claro, oscuro y alto contraste.',
      swatches: [
        { token: '--rms-neutral-0' },
        { token: '--rms-neutral-50' },
        { token: '--rms-neutral-100' },
        { token: '--rms-neutral-200' },
        { token: '--rms-neutral-300' },
        { token: '--rms-neutral-400' },
        { token: '--rms-neutral-500' },
        { token: '--rms-neutral-600' },
        { token: '--rms-neutral-700' },
        { token: '--rms-neutral-800' },
        { token: '--rms-neutral-900' },
        { token: '--rms-neutral-950' },
      ],
    },
    {
      title: 'Marca',
      description:
        'El dorado es relleno. El texto usa brand-text; sobre relleno dorado usa on-brand.',
      swatches: [
        { token: '--rms-brand-500', note: 'relleno' },
        { token: '--rms-brand-600', note: 'resalte' },
        { token: '--rms-brand-700', note: 'activo' },
        { token: '--rms-brand-text', note: 'texto' },
        { token: '--rms-brand-soft', note: 'fondo seleccionado' },
        { token: '--rms-on-brand', note: 'tinta sobre dorado' },
      ],
    },
    {
      title: 'Superficies',
      description: 'La elevación es un paso de superficie más un borde, nunca una sombra.',
      swatches: [
        { token: '--rms-bg-page' },
        { token: '--rms-bg-surface' },
        { token: '--rms-bg-subtle' },
        { token: '--rms-bg-sunken' },
        { token: '--rms-bg-inverse' },
        { token: '--rms-bg-selected' },
        { token: '--rms-bg-disabled' },
        { token: '--rms-bg-overlay' },
      ],
    },
    {
      title: 'Texto y bordes',
      description: 'Cada token de texto cumple AA sobre su superficie prevista.',
      swatches: [
        { token: '--rms-text' },
        { token: '--rms-text-secondary' },
        { token: '--rms-text-muted' },
        { token: '--rms-text-inverse' },
        { token: '--rms-text-disabled' },
        { token: '--rms-link' },
        { token: '--rms-border' },
        { token: '--rms-border-strong' },
      ],
    },
    {
      title: 'Estado — éxito',
      description: 'fg es el único rol permitido sobre texto.',
      swatches: [
        { token: '--rms-success-fg', note: 'fg' },
        { token: '--rms-success-bg', note: 'bg' },
        { token: '--rms-success-border', note: 'border' },
        { token: '--rms-success-solid', note: 'solid' },
      ],
    },
    {
      title: 'Estado — advertencia',
      description: 'Pendiente, reservado, en cola, stock bajo.',
      swatches: [
        { token: '--rms-warning-fg', note: 'fg' },
        { token: '--rms-warning-bg', note: 'bg' },
        { token: '--rms-warning-border', note: 'border' },
        { token: '--rms-warning-solid', note: 'solid' },
      ],
    },
    {
      title: 'Estado — peligro',
      description: 'Cancelado, stock cero, destructivo.',
      swatches: [
        { token: '--rms-danger-fg', note: 'fg' },
        { token: '--rms-danger-bg', note: 'bg' },
        { token: '--rms-danger-border', note: 'border' },
        { token: '--rms-danger-solid', note: 'solid' },
      ],
    },
    {
      title: 'Estado — información y neutro',
      description: 'Preparando, ocupada; entregado, sucia, inactivo.',
      swatches: [
        { token: '--rms-info-fg', note: 'info fg' },
        { token: '--rms-info-bg', note: 'info bg' },
        { token: '--rms-neutral-fg', note: 'neutral fg' },
        { token: '--rms-neutral-bg', note: 'neutral bg' },
      ],
    },
    {
      title: 'Gráficos',
      description: 'Las series categóricas cumplen 3:1 como gráficos en ambos temas.',
      swatches: [
        { token: '--rms-chart-1' },
        { token: '--rms-chart-2' },
        { token: '--rms-chart-3' },
        { token: '--rms-chart-4' },
        { token: '--rms-chart-5' },
        { token: '--rms-chart-6' },
        { token: '--rms-chart-7' },
        { token: '--rms-chart-8' },
        { token: '--rms-chart-grid', note: 'grid' },
        { token: '--rms-chart-axis', note: 'axis' },
      ],
    },
  ];

  readonly typeScale = [
    { className: 'rms-display', label: 'Título grande', meta: '36 / 44 · 700' },
    { className: 'rms-h1', label: 'H1 · Pedidos del día', meta: '30 / 38 · 700' },
    { className: 'rms-h2', label: 'H2 · Ventas', meta: '24 / 32 · 700' },
    { className: 'rms-h3', label: 'H3 · Detalle por categoría', meta: '20 / 28 · 600' },
    { className: 'rms-h4', label: 'H4 · Panel', meta: '16 / 24 · 600' },
    { className: 'rms-body-lg', label: 'Cuerpo grande · texto de servicio', meta: '16 / 26 · 400' },
    { className: 'rms-body', label: 'Cuerpo · texto de administración', meta: '14 / 22 · 400' },
    {
      className: 'rms-caption',
      label: 'Leyenda · actualizado hace 2 minutos',
      meta: '12 / 18 · 400',
    },
    { className: 'rms-label', label: 'Etiqueta · NOMBRE', meta: '12 / 16 · 600' },
    { className: 'rms-numeric', label: 'Numérico · $ 28.000', meta: '16 / 24 · 600 · tabular' },
    {
      className: 'rms-numeric-lg',
      label: 'Numérico grande · $ 1.284.000',
      meta: '30 / 36 · 700 · tabular',
    },
  ];

  readonly spacing = [
    { token: '--rms-space-1', label: '4' },
    { token: '--rms-space-2', label: '8' },
    { token: '--rms-space-3', label: '12' },
    { token: '--rms-space-4', label: '16' },
    { token: '--rms-space-5', label: '20' },
    { token: '--rms-space-6', label: '24' },
    { token: '--rms-space-8', label: '32' },
    { token: '--rms-space-10', label: '40' },
    { token: '--rms-space-12', label: '48' },
    { token: '--rms-space-16', label: '64' },
  ];

  readonly radii = [
    { token: '--rms-radius-sm', label: '8 · controles' },
    { token: '--rms-radius-md', label: '12 · tarjetas' },
    { token: '--rms-radius-lg', label: '16 · paneles' },
    { token: '--rms-radius-full', label: 'completo · píldoras' },
  ];

  readonly motion = [
    { token: '--rms-motion-fast', label: '120ms · resalte, foco, color' },
    { token: '--rms-motion-base', label: '180ms · expandir, pestaña, aviso' },
    { token: '--rms-motion-slow', label: '280ms · hoja, panel lateral' },
    { token: '--rms-motion-chart', label: '240ms · primer renderizado del gráfico' },
    { token: '--rms-ease', label: 'cubic-bezier(.2, 0, 0, 1)' },
    { token: '--rms-ease-exit', label: 'cubic-bezier(.4, 0, 1, 1)' },
  ];

  toggleTheme(dark: boolean): void {
    this.dark.set(dark);
    document.documentElement.classList.toggle('dark', dark);
  }

  toggleContrast(high: boolean): void {
    this.highContrast.set(high);
    if (high) document.documentElement.setAttribute('data-contrast', 'high');
    else document.documentElement.removeAttribute('data-contrast');
  }

  openSheet(side: 'bottom' | 'end'): void {
    this.sheetEnd.set(side === 'end');
    this.sheetOpen.set(true);
  }
}
