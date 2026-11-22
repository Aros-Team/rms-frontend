/** Body of `POST /v1/payments/{id}/void` (full void only, reason required). */
export interface VoidPaymentRequest {
  /** Mandatory justification, max 255 characters. */
  reason: string;
}
