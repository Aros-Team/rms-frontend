import { inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Table } from '../../domain/models/table.model';
import { ChangeStatusRequest } from '../../domain/models/table-request.model';
import { TablesRepositoryPort } from '../ports/output/tables.repository.port';
import { TABLES_REPOSITORY } from '../tokens/tables.tokens';

export class ChangeTableStatusUseCase {
  private repository = inject(TABLES_REPOSITORY);

  execute(id: number, payload: ChangeStatusRequest): Observable<Table> {
    return this.repository.changeTableStatus(id, payload);
  }
}