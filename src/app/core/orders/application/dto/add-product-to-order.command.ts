export interface AddProductToOrderCommand {
  orderId: number;
  productId: number;
  quantity: number;
  note?: string;
}
