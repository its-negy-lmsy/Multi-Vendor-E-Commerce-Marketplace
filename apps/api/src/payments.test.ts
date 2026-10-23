import { describe, expect, it } from 'vitest';
import { signMockPaymentEvent, verifyMockPaymentEvent } from './payments.js';

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
