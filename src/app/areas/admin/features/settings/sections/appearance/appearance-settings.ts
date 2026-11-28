import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import {
  Accessibility,
  type ContrastMode,
  type FontSize,
} from '@services/accessibility/accessibility';
import { Theme, type ThemeName } from '@services/theme/theme';
import { RmsSection } from '@shared/ui/section/section';

/**
 * Appearance section.
 *
 * Theme, text size and contrast are client-side preferences owned by the
 * existing `Theme` and `Accessibility` services; this screen only delegates.
 * Density is not a supported preference yet, so it is documented as read-only
 * instead of shipping a control that does nothing.
 */
@Component({
  selector: 'app-settings-appearance',
  templateUrl: './appearance-settings.html',
  imports: [RmsSection],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppearanceSettingsSection {
  private readonly themeService = inject(Theme);
  private readonly accessibility = inject(Accessibility);

  readonly theme = signal<ThemeName>(this.themeService.get());
  readonly fontSize = this.accessibility.fontSize;
  readonly contrastMode = this.accessibility.contrastMode;

  readonly fontSizes: readonly { id: FontSize; label: string }[] = [
    { id: 'small', label: 'Pequeño' },
    { id: 'normal', label: 'Normal' },
    { id: 'large', label: 'Grande' },
    { id: 'extra-large', label: 'Extra grande' },
  ];

  readonly contrasts: readonly { id: ContrastMode; label: string; description: string }[] = [
    { id: 'normal', label: 'Normal', description: 'Contraste estándar del sistema.' },
    {
      id: 'high',
      label: 'Alto',
      description: 'Refuerza bordes, texto y estados para baja visión.',
    },
  ];

  setTheme(theme: ThemeName): void {
    this.themeService.set(theme);
    this.theme.set(this.themeService.get());
  }

  setFontSize(size: FontSize): void {
    this.accessibility.setFontSize(size);
  }

  setContrast(mode: ContrastMode): void {
    this.accessibility.setContrastMode(mode);
  }
}
