import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { signMockPaymentEvent, verifyMockPaymentEvent, verifyRazorpayWebhook } from './payments.js';

describe('mock payment webhook signatures', () => {
  it('accepts an unchanged payload signed with the local secret', () => {
    const payload = { eventId: 'evt_12345678', orderId: '507f1f77bcf86cd799439011', reference: 'mock_12345678', status: 'paid' };
    expect(verifyMockPaymentEvent(payload, signMockPaymentEvent(payload, 'a'.repeat(32)), 'a'.repeat(32))).toBe(true);
  });
  it('rejects tampered payloads and malformed signatures', () => {
    const payload = { eventId: 'evt_12345678', status: 'paid' };
    const signature = signMockPaymentEvent(payload, 'a'.repeat(32));
    expect(verifyMockPaymentEvent({ ...payload, status: 'failed' }, signature, 'a'.repeat(32))).toBe(false);
    expect(verifyMockPaymentEvent(payload, 'not-a-signature', 'a'.repeat(32))).toBe(false);
  });
});

describe('Razorpay webhook signatures', () => {
  it('verifies the exact raw request body and rejects changes', () => {
    const body = Buffer.from('{"event":"payment.captured","payload":{}}');
    const secret = 'route-webhook-secret';
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyRazorpayWebhook(body, signature, secret)).toBe(true);
    expect(verifyRazorpayWebhook(Buffer.from(`${body.toString()} `), signature, secret)).toBe(false);
    expect(verifyRazorpayWebhook(body, 'not-a-signature', secret)).toBe(false);
  });
});
