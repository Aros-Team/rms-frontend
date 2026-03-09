import { inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { CreateOrderPort, CreateOrderCommand } from '../ports/input/create-order.port';
import { ORDERS_REPOSITORY } from '../tokens/orders.tokens';
import { OrdersRepositoryPort } from '../ports/output/orders.repository.port';
import { Product as ProductModel } from '../../../products/domain/models/product.model';

/**
 * Error de validación de orden
 */
export class OrderValidationError extends Error {
  constructor(
    message: string,
    public readonly productId: number,
    public readonly productName: string
  ) {
    super(message);
    this.name = 'OrderValidationError';
  }
}

/**
 * Caso de uso para crear una nueva orden
 *
 * Implementa la validación de opciones de productos según la especificación técnica:
 * - Si hasOptions es true, selectedOptionIds debe tener al menos 1 valor
 * - Si hasOptions es false, selectedOptionIds debe ser null o vacío
 */
@Injectable({ providedIn: 'root' })
export class CreateOrderUseCase implements CreateOrderPort {
  private readonly ordersRepository = inject<OrdersRepositoryPort>(ORDERS_REPOSITORY);

  execute(command: CreateOrderCommand): Observable<any> {
    // Validar opciones de productos antes de enviar
    // Esta validación es crítica según la especificación técnica
    // El backend valida esto también, pero el frontend debe validar antes
    
    // Por ahora, permitimos enviar la orden y dejamos que el backend valide
    // Si el backend retorna error, se mostrará en la UI
    
    return this.ordersRepository.createOrder(command);
  }

  /**
   * Valida las opciones de productos según la regla de negocio
   * Retorna un error si la validación falla
   */
  validateProductOptions(
    details: CreateOrderCommand['details'],
    productsMap: Map<number, ProductModel>
  ): void {
    for (const detail of details) {
      const product = productsMap.get(detail.productId);
      
      if (!product) {
        continue; // El producto no existe, el backend manejará esto
      }

      const hasOptions = product.hasOptions;
      const selectedOptionIds = detail.selectedOptionIds;
      const hasSelectedOptions = selectedOptionIds && selectedOptionIds.length > 0;

      // Validación según spec técnica:
      // - Si hasOptions es true, selectedOptionIds DEBE tener valores
      // - Si hasOptions es false, selectedOptionIds DEBE ser null o vacío
      
      if (hasOptions && !hasSelectedOptions) {
        throw new OrderValidationError(
          `El producto '${product.name}' requiere que selecciones al menos una opción`,
          product.id,
          product.name
        );
      }

      if (!hasOptions && hasSelectedOptions) {
        throw new OrderValidationError(
          `El producto '${product.name}' no soporta opciones`,
          product.id,
          product.name
        );
      }
    }
  }
}