/**
 * Estados de la máquina de estados de Orders según la especificación técnica
 * QUEUE -> PREPARING -> READY -> DELIVERED
 * También puede ir a CANCELLED desde QUEUE o PREPARING
 */
export enum OrderStatus {
  QUEUE = 'QUEUE',
  PREPARING = 'PREPARING',
  READY = 'READY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

/**
 * Verifica si un estado es válido para transicionar a CANCELLED
 */
export function canCancelOrder(currentStatus: OrderStatus): boolean {
  return currentStatus === OrderStatus.QUEUE || currentStatus === OrderStatus.PREPARING;
}

/**
 * Verifica si un estado es terminal (no hay más transiciones)
 */
export function isTerminalStatus(status: OrderStatus): boolean {
  return status === OrderStatus.DELIVERED || status === OrderStatus.CANCELLED;
}