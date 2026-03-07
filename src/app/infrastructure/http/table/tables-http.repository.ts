import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { TableResponse } from '../../../shared/models/dto/table/table-response.model';

@Injectable({ providedIn: 'root' })
export class TablesHttpRepository {
  getTables(): Observable<TableResponse[]> {
    return of([
      { id: 1, tableNumber: 1, capacity: 4, status: 'AVAILABLE' },
      { id: 2, tableNumber: 2, capacity: 4, status: 'AVAILABLE' },
      { id: 3, tableNumber: 3, capacity: 6, status: 'OCCUPIED' },
      { id: 4, tableNumber: 4, capacity: 2, status: 'AVAILABLE' },
      { id: 5, tableNumber: 5, capacity: 8, status: 'RESERVED' },
      { id: 6, tableNumber: 6, capacity: 4, status: 'AVAILABLE' },
    ]);
  }
}
