import { z } from 'zod';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/fs01'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  ELASTICSEARCH_URL: z.string().url().default('http://localhost:9200'),
  JWT_ACCESS_SECRET: z.string().min(32).default('local-development-only-secret-change-me-123'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(30),
  PLATFORM_COMMISSION_BPS: z.coerce.number().int().min(0).max(10000).default(1000),
  MOCK_PAYMENT_WEBHOOK_SECRET: z.string().min(32).default('local-mock-webhook-secret-replace-before-sharing'),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
  PAYMENT_PROVIDER: z.enum(['mock', 'razorpay']).default('mock'),
  RAZORPAY_KEY_ID: z.string().optional(), RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  DEMO_ADMIN_EMAIL: z.preprocess(value => value === '' ? undefined : value, z.email().optional()),
  DEMO_ADMIN_PASSWORD: z.preprocess(value => value === '' ? undefined : value, z.string().min(12).optional()),
}).superRefine((value, context) => {
  if (Boolean(value.DEMO_ADMIN_EMAIL) !== Boolean(value.DEMO_ADMIN_PASSWORD)) context.addIssue({ code: 'custom', message: 'Set both demo admin email and password, or neither' });
  if (value.NODE_ENV === 'production' && (!process.env.JWT_ACCESS_SECRET || /replace|change|example|local-development/i.test(value.JWT_ACCESS_SECRET))) context.addIssue({ code: 'custom', message: 'Production requires a private JWT_ACCESS_SECRET' });
  if (value.NODE_ENV === 'production' && !process.env.MONGODB_URI) context.addIssue({ code: 'custom', message: 'Production requires MONGODB_URI' });
  if (value.PAYMENT_PROVIDER === 'razorpay' && (!value.RAZORPAY_KEY_ID || !value.RAZORPAY_KEY_SECRET || !value.RAZORPAY_WEBHOOK_SECRET)) context.addIssue({ code: 'custom', message: 'Razorpay requires API key ID, API key secret and webhook secret' });
  if (value.NODE_ENV === 'production' && value.PAYMENT_PROVIDER !== 'razorpay') context.addIssue({ code: 'custom', message: 'Production requires a configured Razorpay Route provider' });
});

export const config = schema.parse(process.env);
