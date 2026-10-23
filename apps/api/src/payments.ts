import { createHmac, timingSafeEqual } from 'node:crypto';

export function signMockPaymentEvent(payload: unknown, secret: string): string {
  return createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
}
export function verifyMockPaymentEvent(payload: unknown, signatureHex: string, secret: string): boolean {
  const expected = Buffer.from(signMockPaymentEvent(payload, secret), 'hex');
  const supplied = Buffer.from(signatureHex, 'hex');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
