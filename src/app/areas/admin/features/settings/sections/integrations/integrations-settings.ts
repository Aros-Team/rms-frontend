import { ChangeDetectionStrategy, Component } from '@angular/core';

import { environment } from '@environments/environment';
import { RmsSection } from '@shared/ui/section/section';

interface IntegrationRow {
  readonly label: string;
  readonly value: string;
  readonly description: string;
}

/**
 * Integrations section — read-only.
 *
 * These are deployment values (`environment.ts`), not editable rows in the
 * database. The screen exists so an admin can confirm what the deployment
 * points at without reading source code; it never renders credentials.
 */
@Component({
  selector: 'app-settings-integrations',
  templateUrl: './integrations-settings.html',
  imports: [RmsSection],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntegrationsSettingsSection {
  readonly rows: readonly IntegrationRow[] = [
    {
      label: 'Servidor de la API',
      value: environment.apiUrl,
      description: 'Origen de los datos del restaurante. Se configura al desplegar.',
    },
    {
      label: 'Canal en tiempo real',
      value: environment.wsUrl,
      description: 'WebSocket de pedidos y cocina.',
    },
    {
      label: 'Agente ABI',
      value: environment.agentHost,
      description: 'Asistente conversacional del panel de administración.',
    },
  ];

  readonly readonlyRows: readonly IntegrationRow[] = [
    {
      label: 'Correo saliente',
      value: 'Configurado en el servidor',
      description: 'Invitaciones y recuperación de contraseña usan el proveedor del backend.',
    },
    {
      label: 'Almacenamiento de imágenes',
      value: 'Configurado en el servidor',
      description: 'Las imágenes de productos se sirven a través de la API.',
    },
  ];
}
