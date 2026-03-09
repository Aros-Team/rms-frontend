import { Observable } from 'rxjs';
import { Table } from '../../../domain/models/table.model';
import { TableRequest, ChangeStatusRequest } from '../../../domain/models/table-request.model';

export interface TablesRepositoryPort {
  /**
   * Obtiene todas las mesas
   * GET /api/v1/tables
   */
  getTables(): Observable<Table[]>;

  /**
   * Obtiene una mesa por ID
   * GET /api/v1/tables/{id}
   */
  getTableById(id: number): Observable<Table>;

  /**
   * Crea una nueva mesa
   * POST /api/v1/tables
   */
  createTable(payload: TableRequest): Observable<Table>;

  /**
   * Actualiza una mesa existente
   * PUT /api/v1/tables/{id}
   */
  updateTable(id: number, payload: TableRequest): Observable<Table>;

  /**
   * Cambia el estado de una mesa
   * PUT /api/v1/tables/{id}/status
   */
  changeTableStatus(id: number, payload: ChangeStatusRequest): Observable<Table>;
}