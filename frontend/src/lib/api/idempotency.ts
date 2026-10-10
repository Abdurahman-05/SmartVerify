/**
 * A new Idempotency-Key (UUID v4) for one user action. Keep it for retries of that same action,
 * so the server does not create a duplicate. Not a secret, so Math.random is an acceptable fallback.
 */
export function newIdempotencyKey(): string {
  const native = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID;
  if (native) return native.call(globalThis.crypto);
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
