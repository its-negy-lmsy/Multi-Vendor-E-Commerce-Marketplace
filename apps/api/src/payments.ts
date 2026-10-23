import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { config } from './config.js';

export type RouteTransfer = { accountId: string; amountPaise: number; vendorId: string };
export type PaymentAttempt = { provider: 'mock' | 'razorpay'; reference: string; keyId?: string };

export async function createPaymentAttempt(input: { amountPaise: number; receipt: string; transfers: RouteTransfer[] }): Promise<PaymentAttempt> {
  if (config.PAYMENT_PROVIDER === 'mock') return { provider: 'mock', reference: `mock_${randomUUID()}` };
  if (!config.RAZORPAY_KEY_ID || !config.RAZORPAY_KEY_SECRET) throw new Error('Razorpay Route credentials are not configured');
  if (!input.transfers.length || input.transfers.some(transfer => !transfer.accountId || transfer.amountPaise < 0)) throw new Error('Approved Razorpay Route linked accounts are required for every vendor');
  const authorization = Buffer.from(`${config.RAZORPAY_KEY_ID}:${config.RAZORPAY_KEY_SECRET}`).toString('base64');
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: `Basic ${authorization}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(8000),
    body: JSON.stringify({
      amount: input.amountPaise, currency: 'INR', receipt: input.receipt, payment_capture: 1,
      transfers: input.transfers.map(transfer => ({ account: transfer.accountId, amount: transfer.amountPaise, currency: 'INR', on_hold: true, notes: { order: input.receipt, vendor: transfer.vendorId } })),
    }),
  });
  const body = await response.json() as { id?: string; error?: { description?: string } };
  if (!response.ok || !body.id) throw new Error(`Razorpay order creation failed (${response.status}): ${body.error?.description ?? 'provider error'}`);
  return { provider: 'razorpay', reference: body.id, keyId: config.RAZORPAY_KEY_ID };
}

export function signMockPaymentEvent(payload: unknown, secret: string): string {
  return createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
}
export function verifyMockPaymentEvent(payload: unknown, signatureHex: string, secret: string): boolean {
  const expected = Buffer.from(signMockPaymentEvent(payload, secret), 'hex');
  const supplied = Buffer.from(signatureHex, 'hex');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function verifyRazorpayWebhook(rawBody: Buffer, signatureHex: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  const supplied = Buffer.from(signatureHex, 'hex');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
