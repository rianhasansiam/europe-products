export type CheckoutIdempotencyAttempt = {
  fingerprint: string;
  key: string;
};

/**
 * Reuse one key when an identical checkout submission is retried, while
 * creating a fresh key after the customer changes any checkout input.
 */
export function resolveCheckoutIdempotencyAttempt(
  previous: CheckoutIdempotencyAttempt | null,
  fingerprint: string,
  createKey: () => string = () => globalThis.crypto.randomUUID(),
): CheckoutIdempotencyAttempt {
  if (previous?.fingerprint === fingerprint) return previous;

  return {
    fingerprint,
    key: createKey(),
  };
}
