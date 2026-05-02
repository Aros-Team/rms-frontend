import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Auth } from '@services/auth/auth';
import { Theme } from '@services/theme/theme';
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

  constructor() {
    this.theme.setDefault()
  }
}
