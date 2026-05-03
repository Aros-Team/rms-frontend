import { Pipe, PipeTransform } from '@angular/core';
import { TableResponse } from '@app/shared/models/dto/tables/table-response.model';

@Pipe({ name: 'tableNumber' })
export class TableNumberPipe implements PipeTransform {
  transform(tables: TableResponse[], tableId: number | null): string {
    if (!tableId) return '';
    const t = tables.find(t => t.id === tableId);
    return t ? String(t.tableNumber) : '';
  }
}
