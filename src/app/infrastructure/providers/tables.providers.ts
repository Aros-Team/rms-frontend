import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { TABLES_REPOSITORY } from '../../core/tables/application/tokens/tables.tokens';
import { TablesHttpRepository } from '../http/table/tables-http.repository';

export function provideTablesInfrastructure(): EnvironmentProviders {
  return makeEnvironmentProviders([
    TablesHttpRepository,
    {
      provide: TABLES_REPOSITORY,
      useExisting: TablesHttpRepository,
    },
  ]);
}