import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Auth } from '@services/auth/auth';
import { Theme } from '@services/theme/theme';
import { Accessibility } from '@services/accessibility/accessibility';
import { ToastModule } from 'primeng/toast';
import { HabeasData } from '@shared/features/habeas-data/habeas-data';


@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastModule, HabeasData],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private theme = inject(Theme);
  private authService = inject(Auth);

  /**
   * Injected for its side effects: the service applies the stored font size and
   * contrast on construction. Without this it was only created when the
   * Settings screen was opened, so a saved preference was not applied after a
   * reload (or on any screen other than Settings).
   */
  private accessibility = inject(Accessibility);

  constructor() {
    this.theme.setDefault()
  }
}
