import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { signMockPaymentEvent } from '../payments.js';

if (config.NODE_ENV === 'production' || config.PAYMENT_PROVIDER !== 'mock') throw new Error('Mock payment events are disabled outside local development');
const [orderId, reference, status = 'paid'] = process.argv.slice(2);
if (!orderId || !reference || !['paid', 'failed'].includes(status)) throw new Error('Usage: npm run payment:mock-event -- <orderId> <reference> [paid|failed]');
const payload = { eventId: `evt_${randomUUID()}`, orderId, reference, status };
console.log(JSON.stringify({ payload, signature: signMockPaymentEvent(payload, config.MOCK_PAYMENT_WEBHOOK_SECRET) }, null, 2));
