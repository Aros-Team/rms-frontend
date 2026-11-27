import type { Money } from '@app/shared/models/dto/common/money';

export interface WorkerResponse {
  id?: number;
  document: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  /** Job title or role inside the assigned area, for example "Jefe de cocina". */
  jobTitle?: string | null;
  role?: 'ADMIN' | 'WORKER';
  status?: 'PENDING' | 'ERROR' | 'ACTIVE' | 'INACTIVE';
  assignedAreas?: number[];
  /** Activities the worker performs in each assigned area. */
  areaActivities?: { areaId: number; activities: string[] }[];
  /**
   * Current salary as a `Money` DTO (`{ amount: "1200000.00", currency: "COP" }`).
   * `null`/absent when the worker has no salary registered. Normalize with
   * `toAmount()` before any math or form binding.
   */
  salary?: Money | null;
  /** Profile image URL (tablet variant), or null when the worker has no photo. */
  imageUrl?: string | null;
}

export interface UpdateWorkerRequest {
  document: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  areas: number[];
  jobTitle?: string | null;
  salary?: number | null;
  reason?: string | null;
  observations?: string | null;
}
