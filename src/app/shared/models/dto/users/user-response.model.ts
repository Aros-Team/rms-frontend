export interface UserResponse {
  id?: number;
  document: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  role?: string;
  assignedAreas?: number[];
}
