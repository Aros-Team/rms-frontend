export interface AuthResponse {
  type: 'SUCCESS' | 'TFA_REQUIRED';
  username: string;
  accessToken: string;
  refreshToken: string | null;
}