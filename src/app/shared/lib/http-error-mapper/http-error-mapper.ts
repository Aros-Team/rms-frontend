import { HttpErrorResponse } from '@angular/common/http';

export function mapHttpError(err: HttpErrorResponse, context?: string): string {
  const body = err.error as Record<string, unknown> | null;
  // RFC 7807 problem responses carry the human-readable text in `detail`;
  // `message` is accepted as a fallback for legacy/plain payloads.
  const message =
    typeof body?.['detail'] === 'string'
      ? body['detail']
      : typeof body?.['message'] === 'string'
        ? body['message']
        : undefined;

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

  if (context === 'payroll') {
    if (err.status === 400) {
      return message ?? 'Datos de nómina inválidos: revisa la cantidad, el valor unitario y las fechas';
    }
    if (err.status === 404) {
      return 'No se encontró la nómina, el evento o la liquidación solicitada';
    }
    if (err.status === 409) {
      return message ?? 'La nómina del periodo ya está cerrada o la liquidación ya fue registrada';
    }
    if (err.status === 0 || err.status >= 500) {
      return 'Error del servidor al procesar la nómina. Intente más tarde.';
    }
    return message ?? 'Error al procesar la nómina';
  }

  if (context === 'order' && (err.status === 404 || err.status === 409)) {
    // Order creation: 404 = table/product missing, 409 = table not available.
    return (
      message ??
      (err.status === 409 ? 'La mesa no está disponible' : 'Mesa o producto no encontrado')
    );
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

  if (err.status === 400 && context === 'product-options') {
    if (message?.toLowerCase().includes('option') && message.toLowerCase().includes('not valid')) {
      return 'Opción no válida para este producto';
    }
    return message ?? 'Error al procesar las opciones del producto';
  }

  if (err.status === 400 && context === 'option-group') {
    if (message?.toLowerCase().includes('grupo')) {
      return 'Completa los grupos de opciones requeridos';
    }
    return message ?? 'Error en los grupos de opciones';
  }

  return message ?? 'Error al procesar la solicitud';
}
