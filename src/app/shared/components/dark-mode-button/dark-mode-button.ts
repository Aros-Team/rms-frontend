import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { Theme } from '@app/core/services/theme/theme';
import { ButtonModule } from 'primeng/button';


@Component({
  selector: 'app-dark-mode-button',
  imports: [ButtonModule],
  templateUrl: './dark-mode-button.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export class DarkModeButton {
  private theme = inject(Theme);

  readonly isDark = signal(this.theme.isDark());

  toggleDarkMode() {
    this.theme.toggle();
    this.isDark.set(this.theme.isDark());
  }
}
