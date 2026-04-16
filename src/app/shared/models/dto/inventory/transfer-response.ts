export interface TransferResponse {
  id: number;
  supplyVariantId: number;
  fromStorageLocationId: number;
  toStorageLocationId: number;
  quantity: number;
  movementType: string;
  createdAt: string;
}
