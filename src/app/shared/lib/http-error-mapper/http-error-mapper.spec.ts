/**
 * Tests for the mapHttpError utility function.
 *
 * Feature: Maps HTTP error responses to user-friendly error messages.
 * Contract: Returns correct message for each known status code; default for unknown.
 * Approach: Import function directly, pass HttpErrorResponse with various statuses, assert messages.
 */
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

  it('returns 400 product-options not valid message', () => {
    const err = new HttpErrorResponse({ status: 400, error: { message: 'Option 5 is not valid for product' } });
    expect(mapHttpError(err, 'product-options')).toBe('Opción no válida para este producto');
  });

  it('returns 400 product-options fallback message', () => {
    const err = new HttpErrorResponse({ status: 400, error: { message: 'Invalid option data' } });
    expect(mapHttpError(err, 'product-options')).toBe('Invalid option data');
  });

  it('returns 400 product-options default when no message', () => {
    const err = new HttpErrorResponse({ status: 400 });
    expect(mapHttpError(err, 'product-options')).toBe('Error al procesar las opciones del producto');
  });

  it('returns 400 option-group grupo message', () => {
    const err = new HttpErrorResponse({ status: 400, error: { message: 'Faltan grupos requeridos' } });
    expect(mapHttpError(err, 'option-group')).toBe('Completa los grupos de opciones requeridos');
  });

  it('returns 400 option-group fallback message', () => {
    const err = new HttpErrorResponse({ status: 400, error: { message: 'Group error' } });
    expect(mapHttpError(err, 'option-group')).toBe('Group error');
  });

  it('returns 400 option-group default when no message', () => {
    const err = new HttpErrorResponse({ status: 400 });
    expect(mapHttpError(err, 'option-group')).toBe('Error en los grupos de opciones');
  });
});
