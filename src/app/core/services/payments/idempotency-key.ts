/**
 * Idempotency key for one charge attempt.
 *
 * The key must be stable across retries of the same attempt (double click,
 * timeout, reconnect) and different for a new attempt. The component stores it
 * in a signal and clears it whenever the draft changes.
 */
export function newIdempotencyKey(): string {
  const cryptoRef = (globalThis as { crypto?: Crypto }).crypto;
  if (typeof cryptoRef?.randomUUID === 'function') {
    return cryptoRef.randomUUID();
  }
  return `charge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
