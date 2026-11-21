/**
 * `POST /v1/workers` payload, unwrapped from the response envelope.
 *
 * The API answers `201 Created` with `UserRegisterResponse`, not with a full
 * worker: the temporary raw password is only present at creation time. Read the
 * worker again through `getWorkers()` when `status`, `assignedAreas` or
 * `salary` are needed.
 */
export interface UserRegisterResponse {
  id: number;
  document: string;
  name: string;
  email: string;
  /** Temporary raw password, returned only by the creation call. */
  password: string | null;
}
