export interface CreateWorkerRequest {
  document: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  areas: number[];
  salary?: number | null;
}