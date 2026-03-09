export interface TableRequest {
  tableNumber: number;
  capacity: number;
}

export interface ChangeStatusRequest {
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED';
}