export interface SetupAccountResponse {
  name: string;
  email: string;
  role: 'ADMIN' | 'WORKER';
}
