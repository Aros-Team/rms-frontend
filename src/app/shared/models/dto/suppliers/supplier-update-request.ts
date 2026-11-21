/**
 * Body of `PUT /v1/suppliers/{id}`.
 *
 * The backend has no `id` field in the payload (the id comes from the path) and
 * requires `active` so the same operation can activate or deactivate a supplier.
 */
export interface SupplierUpdateRequest {
  name: string;
  contact?: string;
  active: boolean;
}
