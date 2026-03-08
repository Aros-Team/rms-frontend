export enum UserRole {
  ADMIN = 'ADMIN',
  WORKER = 'WORKER'
}

export enum UserArea {
  SERVICE = 'serviceArea',
  KITCHEN = 'kitchenArea',
  BAR = 'barArea'
}

export interface User {
  username: string;
  role: UserRole;
  areas: UserArea[];
}

export interface AuthResponse {
  type: string;
  username: string;
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface AuthCredentials {
  username: string;
  password: string;
}
