import { InjectionToken } from '@angular/core';
import { TablesRepositoryPort } from '../ports/output/tables.repository.port';

export const TABLES_REPOSITORY = new InjectionToken<TablesRepositoryPort>('TABLES_REPOSITORY');