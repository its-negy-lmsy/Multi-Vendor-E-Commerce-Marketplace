import { Client } from '@elastic/elasticsearch';
import { randomUUID } from 'node:crypto';
import { config } from './config.js';
import { OutboxEvent, Product } from './models.js';

const indexName = 'fs01-products-v1';
const client = new Client({ node: config.ELASTICSEARCH_URL, requestTimeout: 1200, maxRetries: 0 });
let indexReady = false;
export type ProductSearchFilters = { q: string; page: number; limit: number; category?: string; minPrice?: number; maxPrice?: number; minRating?: number; vendorId?: string; inStock?: boolean; sort?: string };

export async function ensureProductIndex(): Promise<void> {
  if (indexReady) return;
  const exists = await client.indices.exists({ index: indexName });
  if (!exists) await client.indices.create({ index: indexName, mappings: { properties: {
    name: { type: 'text', fields: { keyword: { type: 'keyword' } } }, description: { type: 'text' }, category: { type: 'keyword' },
    vendorId: { type: 'keyword' }, pricePaise: { type: 'integer' }, ratingAverage: { type: 'float' }, stock: { type: 'integer' },
    status: { type: 'keyword' }, createdAt: { type: 'date' },
  } } });
  indexReady = true;
}

export async function queueProductIndex(productId: string): Promise<void> {
  const eventKey = randomUUID();
  await OutboxEvent.create({ eventKey, entityType: 'PRODUCT', entityId: productId, status: 'PENDING', attempts: 0, nextAttemptAt: new Date() });
}

export async function searchElasticProducts(filters: ProductSearchFilters): Promise<{ items: unknown[]; total: number }> {
  await ensureProductIndex();
  const must = filters.q ? [{ multi_match: { query: filters.q, fields: ['name^4', 'category^2', 'description'], fuzziness: 'AUTO' } }] : [{ match_all: {} }];
  const filter: Record<string, unknown>[] = [{ term: { status: 'PUBLISHED' } }];
  if (filters.category) filter.push({ term: { category: filters.category } });
  if (filters.vendorId) filter.push({ term: { vendorId: filters.vendorId } });
  if (filters.inStock) filter.push({ range: { stock: { gt: 0 } } });
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) filter.push({ range: { pricePaise: { ...(filters.minPrice === undefined ? {} : { gte: filters.minPrice }), ...(filters.maxPrice === undefined ? {} : { lte: filters.maxPrice }) } } });
  if (filters.minRating !== undefined) filter.push({ range: { ratingAverage: { gte: filters.minRating } } });
  const sort = filters.sort === 'price_asc' ? [{ pricePaise: 'asc' }] : filters.sort === 'price_desc' ? [{ pricePaise: 'desc' }] : filters.sort === 'newest' ? [{ createdAt: 'desc' }] : filters.sort === 'rating' ? [{ ratingAverage: 'desc' }] : filters.q ? [{ _score: 'desc' }] : [{ createdAt: 'desc' }];
  const response = await client.search({ index: indexName, from: (filters.page - 1) * filters.limit, size: filters.limit, query: { bool: { must, filter } }, sort: sort as never });
  const hits = response.hits.hits.map(hit => ({ ...(hit._source as Record<string, unknown>), _id: hit._id }));
  const totalValue = response.hits.total;
  return { items: hits, total: typeof totalValue === 'number' ? totalValue : totalValue?.value ?? 0 };
}

export async function processOutboxBatch(): Promise<void> {
  try {
    await ensureProductIndex();
    const events = await OutboxEvent.find({ status: 'PENDING', nextAttemptAt: { $lte: new Date() } }).sort({ createdAt: 1 }).limit(25);
    for (const event of events) {
      try {
        const product = await Product.findById(event.entityId).lean();
        if (!product || product.status !== 'PUBLISHED') {
          await client.delete({ index: indexName, id: String(event.entityId) }).catch((error: { meta?: { statusCode?: number } }) => { if (error.meta?.statusCode !== 404) throw error; });
        } else {
          const { _id, ...document } = product;
          await client.index({ index: indexName, id: String(_id), document: { ...document, vendorId: String(product.vendorId) } });
        }
        event.status = 'PROCESSED'; event.lastError = ''; await event.save();
      } catch (error) {
        event.attempts += 1; event.lastError = error instanceof Error ? error.message.slice(0, 500) : 'index operation failed';
        if (event.attempts >= 8) event.status = 'DEAD';
        else event.nextAttemptAt = new Date(Date.now() + Math.min(300000, 1000 * 2 ** event.attempts));
        await event.save();
      }
    }
  } catch { /* dependency outages leave events pending; request paths report MongoDB fallback explicitly */ }
}

export async function reindexProducts(): Promise<number> {
  await ensureProductIndex();
  await client.indices.delete({ index: indexName, ignore_unavailable: true });
  indexReady = false;
  await ensureProductIndex();
  let count = 0;
  for await (const product of Product.find({ status: 'PUBLISHED' }).lean().cursor()) {
    const { _id, ...document } = product;
    await client.index({ index: indexName, id: String(_id), document: { ...document, vendorId: String(product.vendorId) } }); count += 1;
  }
  return count;
}
