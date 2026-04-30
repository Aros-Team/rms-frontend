export interface DayMenuResponse {
  id: number;
  productId: number;
  productName: string;
  productBasePrice: number;
  validFrom: string;
  createdBy: string;
}

export interface DayMenuHistoryResponse {
  id: number;
  productId: number;
  productName: string;
  productBasePrice: number;
  validFrom: string;
  validUntil: string;
  createdBy: string;
}

export interface DayMenuHistoryPage {
  content: DayMenuHistoryResponse[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}
