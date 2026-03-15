export interface OrderResponse {
  id: number;
  date: string;
  status: 'QUEUE' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';
  tableId: number;
  details?: OrderDetailResponse[];
  totalPrice?: number;
}

export interface OrderDetailResponse {
  id: number;
  productId: number;
  productName: string;
  unitPrice: number;
  instructions?: string;
  selectedOptions?: ProductOptionResponse[];
}

export interface ProductOptionResponse {
  id: number;
  name: string;
  categoryName: string;
}
