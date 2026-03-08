export interface RmsCartItemData {
  id: string | number;
  name: string;
  price: number;
  quantity: number;
  instructions?: string;
}

export interface RmsCartItemOptions {
  item: RmsCartItemData;
  currency?: string;
}

export interface RmsCartItemInputs extends RmsCartItemOptions {
  item: RmsCartItemData;
  currency: string;
}
