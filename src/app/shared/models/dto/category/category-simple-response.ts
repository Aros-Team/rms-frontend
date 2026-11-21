export interface CategorySimpleResponse {
  id: number;
  name: string;
  /** Present on the wire; `CategoryController` always returns it (may be null for legacy rows). */
  description?: string | null;
  enabled: boolean;
}
