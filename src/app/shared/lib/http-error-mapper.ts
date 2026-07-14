import { HttpErrorResponse } from '@angular/common/http';

export function mapHttpError(err: HttpErrorResponse, context?: string): string {
  const body = err.error as Record<string, unknown> | null;
  const message = typeof body?.['message'] === 'string' ? body['message'] : undefined;

  if (err.status === 400 && context === 'order') {
    const bodyLower = message?.toLowerCase() ?? '';
    if (bodyLower.includes('grupo')) {
      const groups = body?.['missingGroups'];
      if (Array.isArray(groups) && groups.length > 0) {
        return `Completa los grupos requeridos: ${groups.join(', ')}`;
      }
      return 'Completa los grupos requeridos';
    }
    if (bodyLower.includes('clarificacion') || bodyLower.includes('pregunta')) {
      return 'Responde las preguntas obligatorias';
    }
  }

  if (err.status === 400 && context === 'schedule') {
    return 'Horario inválido: la hora de inicio debe ser menor a la hora de fin';
  }

  if (err.status === 409) {
    return 'Este menú no está disponible en este horario';
  }

  if (err.status === 404) {
    return 'Este menú ya no está disponible';
  }

  if (err.status === 422 && context === 'special-selections') {
    return 'Configura el costo unitario de los insumos para obtener un precio sugerido';
  }

  return message ?? 'Error al procesar la solicitud';
}
