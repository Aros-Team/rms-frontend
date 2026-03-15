export interface TableRequest {
  tableNumber: number;
  capacity: number;
}

export interface TableResponse {
  id: number;
  tableNumber: number;
  capacity: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED';
}

export interface ChangeStatusRequest {
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED';
}
