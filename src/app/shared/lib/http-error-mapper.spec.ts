import { HttpErrorResponse } from '@angular/common/http';
import { mapHttpError } from './http-error-mapper';

describe('mapHttpError', () => {
  it('returns default message for unknown status', () => {
    const err = new HttpErrorResponse({ status: 500, error: { message: 'Server error' } });
    expect(mapHttpError(err)).toBe('Server error');
  });

  it('returns fallback when no message', () => {
    const err = new HttpErrorResponse({ status: 500 });
    expect(mapHttpError(err)).toBe('Error al procesar la solicitud');
  });

  it('returns 409 schedule message', () => {
    const err = new HttpErrorResponse({ status: 409 });
    expect(mapHttpError(err)).toBe('Este menú no está disponible en este horario');
  });

  it('returns 404 message', () => {
    const err = new HttpErrorResponse({ status: 404 });
    expect(mapHttpError(err)).toBe('Este menú ya no está disponible');
  });

  it('returns 422 special-selections message', () => {
    const err = new HttpErrorResponse({ status: 422, error: { message: '', missingVariants: [1, 2] } });
    expect(mapHttpError(err, 'special-selections')).toBe('Configura el costo unitario de los insumos para obtener un precio sugerido');
  });

  it('returns 400 order missingGroups message', () => {
    const err = new HttpErrorResponse({ status: 400, error: { message: 'Faltan grupos requeridos', missingGroups: ['Sopa', 'Plato'] } });
    expect(mapHttpError(err, 'order')).toBe('Completa los grupos requeridos: Sopa, Plato');
  });

  it('returns 400 order clarification message', () => {
    const err = new HttpErrorResponse({ status: 400, error: { message: 'Falta clarificacion requerida' } });
    expect(mapHttpError(err, 'order')).toBe('Responde las preguntas obligatorias');
  });

  it('returns 400 schedule message with schedule context', () => {
    const err = new HttpErrorResponse({ status: 400, error: { message: 'Horario invalido' } });
    expect(mapHttpError(err, 'schedule')).toBe('Horario inválido: la hora de inicio debe ser menor a la hora de fin');
  });

  it('returns original message when 400 without known context', () => {
    const err = new HttpErrorResponse({ status: 400, error: { message: 'Bad Request' } });
    expect(mapHttpError(err)).toBe('Bad Request');
  });
});
