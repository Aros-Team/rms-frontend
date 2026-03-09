export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED';

export interface Table {
  id: number;
  tableNumber: number;
  capacity: number;
  status: TableStatus;
}