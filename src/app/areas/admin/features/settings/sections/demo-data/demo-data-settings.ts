import { ChangeDetectionStrategy, Component, isDevMode } from '@angular/core';

import { RmsSection } from '@shared/ui/section/section';

interface DemoCommand {
  readonly label: string;
  readonly description: string;
  readonly command: string;
}

/**
 * Demo data section — dev only.
 *
 * There is no destructive button: the HTTP reset endpoint only exists when
 * `app.seed.enabled=true` and the profile is `dev`/`test`, so the card documents
 * the CLI commands instead of pretending the UI can trigger a reset anywhere.
 */
@Component({
  selector: 'app-settings-demo-data',
  templateUrl: './demo-data-settings.html',
  imports: [RmsSection],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DemoDataSettingsSection {
  readonly isDev = isDevMode();

  readonly commands: readonly DemoCommand[] = [
    {
      label: 'Restablecer el conjunto de demostración',
      description: 'Genera 180 días deterministas anclados a la fecha indicada.',
      command: './gradlew seedReset -Panchor=2026-11-21 -Pdays=180 -Pdataset=dev',
    },
    {
      label: 'Verificar el conjunto generado',
      description: 'Comprueba conteos y checksums; falla si el estado no es el esperado.',
      command: './gradlew seedVerify -Panchor=2026-11-21',
    },
    {
      label: 'Consultar el estado del seed',
      description: 'Devuelve el ancla, los conteos y los checksums del conjunto actual.',
      command: 'GET /api/v1/dev/seed/status',
    },
  ];
}
