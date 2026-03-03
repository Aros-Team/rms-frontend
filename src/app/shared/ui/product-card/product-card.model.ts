export interface ProductCardViewModel {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  isActive: boolean;
  imageUrl?: string;
  tags?: string[];
}

export interface ProductCardActionPayload {
  productId: number;
}
