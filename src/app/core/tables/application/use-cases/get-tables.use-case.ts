import { inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Table } from '../../domain/models/table.model';
import { TablesRepositoryPort } from '../ports/output/tables.repository.port';
import { TABLES_REPOSITORY } from '../tokens/tables.tokens';

export class GetTablesUseCase {
  private repository = inject(TABLES_REPOSITORY);

  execute(): Observable<Table[]> {
    return this.repository.getTables();
  }
}