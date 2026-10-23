import { Redis } from 'ioredis';
import { config } from './config.js';

const redis = new Redis(config.REDIS_URL, { lazyConnect: true, connectTimeout: 1200, maxRetriesPerRequest: 1, retryStrategy: () => null, enableOfflineQueue: false });
redis.on('error', () => { /* Redis is an optional disposable projection; requests fall back to MongoDB. */ });

async function ready(): Promise<boolean> {
  try { if (redis.status === 'wait') await redis.connect(); return redis.status === 'ready'; }
  catch { return false; }
}
export async function readCartCache(userId: string): Promise<string | null> {
  if (!await ready()) return null;
  try { return await redis.get(`cart:${userId}`); } catch { return null; }
}
export async function writeCartCache(userId: string, serialized: string): Promise<boolean> {
  if (!await ready()) return false;
  try { await redis.set(`cart:${userId}`, serialized, 'EX', 60 * 60 * 24 * 30); return true; } catch { return false; }
}
export async function clearCartCache(userId: string): Promise<void> {
  if (!await ready()) return;
  try { await redis.del(`cart:${userId}`); } catch { /* cache invalidation can be repaired from MongoDB */ }
}
export async function closeCache(): Promise<void> { if (redis.status !== 'end') await redis.quit().catch(() => undefined); }
