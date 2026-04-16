export interface TransferItem {
  supplyVariantId: number;
  quantity: number;
}

export interface TransferRequest {
  items: TransferItem[];
}
