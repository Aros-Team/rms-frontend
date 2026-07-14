export interface OrderDetailsResponse {
  id: number;
  status: string; // expecting values like 'PENDING', 'COMPLETED', etc.
  takedAt: string;
  total: number;
  tableName: string;
  responsibleName: string;
  clientOrders: ClientOrder[];
}

export interface ClientOrder {
  id: number;
  total: number;
  status: string;
  details: ClientOrderDetail[];
}

export interface ClientOrderAddition {
  name: string;
  extraPrice: number;
}

export interface ClientOrderClarification {
  question: string;
  answer: string;
}

export interface ClientGroupSelection {
  groupName: string;
  selectedOptions: string[];
}

export interface ClientOrderDetail {
  id: number;
  name: string;
  price: number;
  quantity: number;
  observations: string;
  selectionType?: 'STANDARD' | 'SPECIAL_SELECTION';
  additions?: ClientOrderAddition[];
  clarifications?: ClientOrderClarification[];
  groupSelections?: ClientGroupSelection[];
}
