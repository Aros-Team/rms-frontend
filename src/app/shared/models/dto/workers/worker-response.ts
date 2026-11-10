import type { Money } from '@app/shared/models/dto/common/money';

export interface WorkerResponse {
  id?: number;
  document: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  role?: 'ADMIN' | 'WORKER';
  status?: 'PENDING' | 'ERROR' | 'ACTIVE' | 'INACTIVE';
  assignedAreas?: number[];
  /**
   * Current salary as a `Money` DTO (`{ amount: "1200000.00", currency: "COP" }`).
   * `null`/absent when the worker has no salary registered. Normalize with
   * `toAmount()` before any math or form binding.
   */
  salary?: Money | null;
}

export interface UpdateWorkerRequest {
  document: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  areas: number[];
  salary?: number | null;
  reason?: string | null;
  observations?: string | null;
}
