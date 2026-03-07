export interface OrderResponse {
  id: number;
  date: string;
  status: string;
  tableId: number;
  details: OrderDetailResponse[];
}

export interface OrderDetailResponse {
  id: number;
  productId: number;
  productName: string;
  unitPrice: number;
  instructions: string | null;
  selectedOptions: ProductOptionResponse[];
}

export interface ProductOptionResponse {
  id: number;
  name: string;
  categoryName: string;
}
