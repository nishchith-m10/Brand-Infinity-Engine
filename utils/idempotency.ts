import crypto from 'crypto';

export function generateIdempotencyKey(data: unknown) {
  const json = JSON.stringify(data);
  const hash = crypto.createHash('sha256').update(json).digest('hex');
  return `idempotency:${hash}`;
}
