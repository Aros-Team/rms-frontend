export interface CreateUserRequest {
  document: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
}