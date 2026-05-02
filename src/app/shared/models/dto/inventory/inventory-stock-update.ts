export interface UpdatedStockItem {
  supplyVariantId: number;
  storageLocationId: number;
  /** Backend storage location name. Known values: 'BODEGA' | 'COCINA' */
  locationName: string;
  currentQuantity: number;
}

export interface InventoryStockUpdatedEvent {
  /** Discriminator field. Expected value: 'INVENTORY_UPDATED' */
  type: string;
  updatedItems: UpdatedStockItem[];
}
