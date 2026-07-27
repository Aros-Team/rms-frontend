export interface SetupPasswordRequest {
  token: string;
  newPassword: string;
  name?: string;
  document?: string;
}
