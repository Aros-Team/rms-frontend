export interface UserResponse {
  id?: number;
  document: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  role?: 'ADMIN' | 'WORKER';
  status?: 'PENDING' | 'ERROR' | 'ACTIVE' | 'INACTIVE';
  assignedAreas?: number[];
  salary?: number | null;
}

export interface UpdateUserRequest {
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
