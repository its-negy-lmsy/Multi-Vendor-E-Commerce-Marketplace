import express from 'express';
import { randomUUID } from 'node:crypto';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import swaggerUi from 'swagger-ui-express';
import yaml from 'js-yaml';
import path from 'node:path';
import { config } from './config.js';
import { Address, AuditLog, Cart, Coupon, Order, Payment, Product, RefreshSession, Review, User, VendorLedgerEntry, VendorProfile, Wishlist } from './models.js';
import { hashToken, makeRefreshToken, refreshCookieOptions, requireAuth, requireRoles, signAccessToken } from './auth.js';
import { calculateTotals } from './commerce.js';
import { clearCartCache, readCartCache, writeCartCache } from './cache.js';
import { processOutboxBatch, queueProductIndex, searchElasticProducts } from './search.js';
import { createPaymentAttempt, signMockPaymentEvent, verifyMockPaymentEvent, verifyRazorpayWebhook } from './payments.js';
import { saveBase64Image } from './storage.js';
import { renderInvoiceHtml } from './invoice.js';

declare global { namespace Express { interface Request { rawBody?: Buffer } } }

export const app = express();
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({ origin: config.WEB_ORIGIN, credentials: true }));
app.use(express.json({ limit: '10mb', verify: (req, _res, buffer) => { (req as express.Request).rawBody = Buffer.from(buffer); } }));
app.use(cookieParser());
app.use('/uploads', express.static(path.resolve(fileURLToPath(new URL('../public/uploads', import.meta.url)))));
app.use((req, res, next) => { res.setHeader('x-request-id', req.headers['x-request-id']?.toString().slice(0, 100) || crypto.randomUUID()); next(); });

if (config.NODE_ENV !== 'production') {
  const specPath = fileURLToPath(new URL('../docs/openapi.yaml', import.meta.url));
  const openApi = yaml.load(await readFile(specPath, 'utf8')) as swaggerUi.JsonObject;
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApi));
}

app.get('/api/v1/health/live', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/v1/health/ready', (_req, res) => {
  const database = mongoose.connection.readyState === 1;
  res.status(database ? 200 : 503).json({ status: database ? 'ready' : 'not_ready', dependencies: { mongodb: database ? 'connected' : 'disconnected' } });
});

const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.NODE_ENV === 'production' ? 20 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
});
const registerSchema = z.object({ name: z.string().trim().min(2).max(80), email: z.email().max(254), password: z.string().min(10).max(128) }).strict();
const loginSchema = z.object({ email: z.email().max(254), password: z.string().min(1).max(128) }).strict();
const publicUser = (user: { _id: unknown; name: string; email: string; role: string }) => ({ id: String(user._id), name: user.name, email: user.email, role: user.role });
const requireApprovedVendor: express.RequestHandler = async (req, res, next) => {
  try {
    const profile = await VendorProfile.findOne({ userId: req.identity!.id, status: 'APPROVED' }).select('_id').lean();
    if (!profile) { res.status(403).json({ error: { code: 'VENDOR_NOT_APPROVED', message: 'An approved vendor profile is required' } }); return; }
    next();
  } catch (error) { next(error); }
};

async function establishSession(user: { _id: unknown; name: string; email: string; role: string }, res: express.Response) {
  const refresh = makeRefreshToken();
  await RefreshSession.create({ userId: user._id, tokenHash: hashToken(refresh), expiresAt: new Date(Date.now() + config.REFRESH_TOKEN_DAYS * 86400000) });
  res.cookie('fs01_refresh', refresh, refreshCookieOptions());
  const identity = publicUser(user) as { id: string; name: string; email: string; role: 'CUSTOMER' | 'VENDOR' | 'ADMIN' };
  res.json({ accessToken: signAccessToken(identity), user: identity });
}

app.post('/api/v1/auth/register', authLimit, async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await User.create({ name: input.name, email: input.email.toLowerCase(), passwordHash, role: 'CUSTOMER' });
    await establishSession(user, res);
  } catch (error) {
    if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) { res.status(409).json({ error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists' } }); return; }
    next(error);
  }
});

app.post('/api/v1/auth/login', authLimit, async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const user = await User.findOne({ email: input.email.toLowerCase() }).select('+passwordHash');
    if (!user || user.status !== 'ACTIVE' || !(await bcrypt.compare(input.password, user.passwordHash))) { res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect' } }); return; }
    await establishSession(user, res);
  } catch (error) { next(error); }
});

app.post('/api/v1/auth/refresh', async (req, res, next) => {
  try {
    const token = req.cookies?.fs01_refresh;
    if (!token) { res.status(401).json({ error: { code: 'NO_SESSION', message: 'Sign in again to continue' } }); return; }
    const session = await RefreshSession.findOneAndUpdate({ tokenHash: hashToken(token), revokedAt: null, expiresAt: { $gt: new Date() } }, { $set: { revokedAt: new Date() } }, { new: false });
    if (!session) { res.clearCookie('fs01_refresh', refreshCookieOptions()); res.status(401).json({ error: { code: 'INVALID_SESSION', message: 'Sign in again to continue' } }); return; }
    const user = await User.findOne({ _id: session.userId, status: 'ACTIVE' });
    if (!user) { res.status(401).json({ error: { code: 'INVALID_SESSION', message: 'Account is unavailable' } }); return; }
    await establishSession(user, res);
  } catch (error) { next(error); }
});

app.post('/api/v1/auth/logout', requireAuth, async (req, res, next) => {
  try {
    const token = req.cookies?.fs01_refresh;
    if (token) await RefreshSession.updateOne({ tokenHash: hashToken(token), userId: req.identity!.id, revokedAt: null }, { $set: { revokedAt: new Date() } });
    res.clearCookie('fs01_refresh', refreshCookieOptions()); res.status(204).end();
  } catch (error) { next(error); }
});
app.get('/api/v1/auth/me', requireAuth, (req, res) => res.json({ user: req.identity }));
app.get('/api/v1/admin/ping', requireAuth, requireRoles('ADMIN'), (_req, res) => res.json({ access: 'admin' }));

app.get('/api/v1/products', async (req, res, next) => {
  try {
    const query = z.object({ q: z.string().trim().max(100).default(''), page: z.coerce.number().int().min(1).max(10000).default(1), limit: z.coerce.number().int().min(1).max(48).default(12), category: z.string().trim().max(80).optional(), minPrice: z.coerce.number().int().min(0).optional(), maxPrice: z.coerce.number().int().min(0).optional(), minRating: z.coerce.number().min(0).max(5).optional(), vendorId: z.string().refine(mongoose.isValidObjectId).optional(), inStock: z.enum(['true', 'false']).optional(), sort: z.enum(['relevance', 'price_asc', 'price_desc', 'newest', 'rating']).default('relevance') }).refine(value => value.minPrice === undefined || value.maxPrice === undefined || value.minPrice <= value.maxPrice).parse(req.query);
    const { page, limit } = query;
    const approvedVendorIds = await VendorProfile.distinct('userId', { status: 'APPROVED' });
    try {
      const result = await searchElasticProducts({ ...query, inStock: query.inStock === 'true' });
      const ids = result.items.map(item => String((item as { _id: string })._id));
      const authoritative: Record<string, unknown> = { _id: { $in: ids }, status: 'PUBLISHED', vendorId: { $in: approvedVendorIds } };
      if (query.category) authoritative.category = query.category;
      if (query.vendorId) authoritative.vendorId = { $in: approvedVendorIds, $eq: query.vendorId };
      if (query.inStock === 'true') authoritative.stock = { $gt: 0 };
      if (query.minPrice !== undefined || query.maxPrice !== undefined) authoritative.pricePaise = { ...(query.minPrice === undefined ? {} : { $gte: query.minPrice }), ...(query.maxPrice === undefined ? {} : { $lte: query.maxPrice }) };
      if (query.minRating !== undefined) authoritative.ratingAverage = { $gte: query.minRating };
      const currentProducts = await Product.find(authoritative).lean();
      const byId = new Map(currentProducts.map(item => [String(item._id), item]));
      res.json({ items: ids.flatMap(id => { const item = byId.get(id); return item ? [item] : []; }), page, limit, total: result.total, searchEngine: 'elasticsearch' }); return;
    } catch { /* Elasticsearch failure is visible in the response engine label below. */ }
    const q = String(req.query.q ?? '').trim().slice(0, 100);
    const filter: Record<string, unknown> = { status: 'PUBLISHED', vendorId: { $in: approvedVendorIds } };
    if (q) filter.$or = [{ name: { $regex: escapeRegex(q), $options: 'i' } }, { description: { $regex: escapeRegex(q), $options: 'i' } }, { category: { $regex: escapeRegex(q), $options: 'i' } }];
    if (query.category) filter.category = query.category;
    if (query.vendorId) filter.vendorId = { $in: approvedVendorIds, $eq: query.vendorId };
    if (query.inStock === 'true') filter.stock = { $gt: 0 };
    if (query.minPrice !== undefined || query.maxPrice !== undefined) filter.pricePaise = { ...(query.minPrice === undefined ? {} : { $gte: query.minPrice }), ...(query.maxPrice === undefined ? {} : { $lte: query.maxPrice }) };
    if (query.minRating !== undefined) filter.ratingAverage = { $gte: query.minRating };
    const sort: Record<string, 1 | -1> = query.sort === 'price_asc' ? { pricePaise: 1 } : query.sort === 'price_desc' ? { pricePaise: -1 } : query.sort === 'rating' ? { ratingAverage: -1 } : { createdAt: -1 };
    const [items, total] = await Promise.all([Product.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(), Product.countDocuments(filter)]);
    res.json({ items, page, limit, total, searchEngine: 'mongodb-fallback' });
  } catch (error) { next(error); }
});
app.get('/api/v1/products/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Product not found' } }); return; }
    const product = await Product.findOne({ _id: req.params.id, status: 'PUBLISHED' }).lean();
    if (!product) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Product not found' } }); return; }
    if (!await VendorProfile.exists({ userId: product.vendorId, status: 'APPROVED' })) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Product not found' } }); return; }
    res.json({ item: product });
  } catch (error) { next(error); }
});

const applicationSchema = z.object({ shopName: z.string().trim().min(2).max(100), description: z.string().trim().min(20).max(2000) }).strict();
const productInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().min(20).max(6000),
  category: z.string().trim().min(2).max(80),
  pricePaise: z.number().int().safe().min(1),
  mrpPaise: z.number().int().safe().min(1).optional(),
  badge: z.string().trim().max(50).optional(),
  specs: z.record(z.string(), z.string()).optional(),
  stock: z.number().int().safe().min(0),
  imageUrl: z.string().max(2048).optional(),
}).strict();
const slugFor = (value: string) => value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 70);

app.post('/api/v1/vendors/application', requireAuth, requireRoles('CUSTOMER'), async (req, res, next) => {
  try {
    const input = applicationSchema.parse(req.body);
    const existing = await VendorProfile.findOne({ userId: req.identity!.id });
    if (existing && ['PENDING', 'APPROVED', 'SUSPENDED'].includes(existing.status)) { res.status(409).json({ error: { code: 'APPLICATION_EXISTS', message: 'A vendor application already exists' } }); return; }
    const baseSlug = slugFor(input.shopName) || 'maker';
    const profile = await VendorProfile.findOneAndUpdate({ userId: req.identity!.id }, { $set: { shopName: input.shopName, description: input.description, status: 'PENDING', slug: `${baseSlug}-${req.identity!.id.slice(-6)}`, reviewedBy: null, reviewedAt: null, rejectionReason: '' } }, { upsert: true, new: true, runValidators: true });
    res.status(201).json({ application: profile });
  } catch (error) { next(error); }
});
app.get('/api/v1/vendors/me', requireAuth, requireRoles('VENDOR'), async (req, res, next) => {
  try { res.json({ profile: await VendorProfile.findOne({ userId: req.identity!.id }).select('-razorpayLinkedAccountId') }); } catch (error) { next(error); }
});
app.get('/api/v1/admin/vendors', requireAuth, requireRoles('ADMIN'), async (req, res, next) => {
  try {
    const filter = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'].includes(String(req.query.status)) ? { status: String(req.query.status) } : {};
    res.json({ items: await VendorProfile.find(filter).sort({ createdAt: -1 }).limit(100).lean() });
  } catch (error) { next(error); }
});
app.patch('/api/v1/admin/vendors/:id/status', requireAuth, requireRoles('ADMIN'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Vendor application not found' } }); return; }
    const input = z.object({ status: z.enum(['APPROVED', 'REJECTED', 'SUSPENDED']), reason: z.string().trim().max(500).default('') }).strict().parse(req.body);
    const profile = await VendorProfile.findById(req.params.id);
    if (!profile) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Vendor application not found' } }); return; }
    profile.status = input.status; profile.reviewedBy = new mongoose.Types.ObjectId(req.identity!.id); profile.reviewedAt = new Date(); profile.rejectionReason = input.status === 'REJECTED' ? input.reason : ''; await profile.save();
    await User.updateOne({ _id: profile.userId }, { $set: { role: input.status === 'APPROVED' ? 'VENDOR' : 'CUSTOMER', status: input.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE' } });
    await AuditLog.create({ actorId: req.identity!.id, action: `vendor.${input.status.toLowerCase()}`, resourceType: 'VendorProfile', resourceId: String(profile._id), summary: input.reason || `Vendor application status set to ${input.status}`, requestId: String(res.getHeader('x-request-id')) });
    res.json({ application: profile });
  } catch (error) { next(error); }
});
app.patch('/api/v1/admin/vendors/:id/razorpay-linked-account', requireAuth, requireRoles('ADMIN'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Vendor profile not found' } }); return; }
    const input = z.object({ linkedAccountId: z.string().regex(/^acc_[A-Za-z0-9]+$/).max(80) }).strict().parse(req.body);
    const profile = await VendorProfile.findOneAndUpdate({ _id: req.params.id, status: 'APPROVED' }, { $set: { razorpayLinkedAccountId: input.linkedAccountId } }, { new: true });
    if (!profile) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Approved vendor profile not found' } }); return; }
    await AuditLog.create({ actorId: req.identity!.id, action: 'vendor.razorpay_linked_account.updated', resourceType: 'VendorProfile', resourceId: String(profile._id), summary: 'Razorpay Route linked account reference updated', requestId: String(res.getHeader('x-request-id')) });
    res.json({ profile: { id: String(profile._id), status: profile.status, linked: true } });
  } catch (error) { next(error); }
});

app.get('/api/v1/vendor/products', requireAuth, requireRoles('VENDOR'), requireApprovedVendor, async (req, res, next) => {
  try { res.json({ items: await Product.find({ vendorId: req.identity!.id }).sort({ updatedAt: -1 }).limit(100).lean() }); } catch (error) { next(error); }
});
app.post('/api/v1/vendor/products', requireAuth, requireRoles('VENDOR'), requireApprovedVendor, async (req, res, next) => {
  try {
    const input = productInputSchema.parse(req.body);
    const slug = `${slugFor(input.name) || 'product'}-${Date.now().toString(36)}`;
    const product = await Product.create({ ...input, slug, vendorId: req.identity!.id, status: 'PENDING' });
    await queueProductIndex(String(product._id));
    res.status(201).json({ item: product });
  } catch (error) {
    if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) { res.status(409).json({ error: { code: 'PRODUCT_CONFLICT', message: 'Product conflicts with an existing record' } }); return; }
    next(error);
  }
});
app.patch('/api/v1/vendor/products/:id', requireAuth, requireRoles('VENDOR'), requireApprovedVendor, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Product not found' } }); return; }
    const input = productInputSchema.partial().refine(value => Object.keys(value).length > 0).parse(req.body);
    const product = await Product.findOneAndUpdate({ _id: req.params.id, vendorId: req.identity!.id, status: { $ne: 'ARCHIVED' } }, { $set: { ...input, status: 'PENDING' } }, { new: true, runValidators: true });
    if (!product) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Product not found' } }); return; }
    await queueProductIndex(String(product._id));
    res.json({ item: product });
  } catch (error) { next(error); }
});
app.delete('/api/v1/vendor/products/:id', requireAuth, requireRoles('VENDOR'), requireApprovedVendor, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Product not found' } }); return; }
    const product = await Product.findOneAndUpdate({ _id: req.params.id, vendorId: req.identity!.id }, { $set: { status: 'ARCHIVED' } }, { new: true });
    if (!product) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Product not found' } }); return; }
    await queueProductIndex(String(product._id));
    res.status(204).end();
  } catch (error) { next(error); }
});
app.patch('/api/v1/admin/products/:id/status', requireAuth, requireRoles('ADMIN'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Product not found' } }); return; }
    const input = z.object({ status: z.enum(['PUBLISHED', 'ARCHIVED']) }).strict().parse(req.body);
    const product = await Product.findByIdAndUpdate(req.params.id, { $set: { status: input.status } }, { new: true, runValidators: true });
    if (!product) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Product not found' } }); return; }
    await queueProductIndex(String(product._id));
    await AuditLog.create({ actorId: req.identity!.id, action: `product.${input.status.toLowerCase()}`, resourceType: 'Product', resourceId: String(product._id), summary: `Product moderation status set to ${input.status}`, requestId: String(res.getHeader('x-request-id')) });
    res.json({ item: product });
  } catch (error) { next(error); }
});

const addressInputSchema = z.object({ label: z.string().trim().min(1).max(40), recipient: z.string().trim().min(2).max(100), phone: z.string().trim().regex(/^[+\d][\d ()-]{7,18}$/), line1: z.string().trim().min(3).max(200), line2: z.string().trim().max(200).default(''), city: z.string().trim().min(2).max(80), state: z.string().trim().min(2).max(80), postalCode: z.string().trim().regex(/^[A-Za-z0-9 -]{4,12}$/), country: z.string().trim().min(2).max(80).default('India'), isDefault: z.boolean().default(false) }).strict();
app.get('/api/v1/users/me/addresses', requireAuth, requireRoles('CUSTOMER'), async (req, res, next) => {
  try { res.json({ items: await Address.find({ userId: req.identity!.id }).sort({ isDefault: -1, createdAt: -1 }).lean() }); } catch (error) { next(error); }
});
app.post('/api/v1/users/me/addresses', requireAuth, requireRoles('CUSTOMER'), async (req, res, next) => {
  try {
    const input = addressInputSchema.parse(req.body);
    if (input.isDefault) await Address.updateMany({ userId: req.identity!.id }, { $set: { isDefault: false } });
    const address = await Address.create({ ...input, userId: req.identity!.id });
    res.status(201).json({ address });
  } catch (error) { next(error); }
});

app.get('/api/v1/users/me/wishlist', requireAuth, requireRoles('CUSTOMER'), async (req, res, next) => {
  try {
    const list = await Wishlist.findOne({ userId: req.identity!.id }).lean();
    res.json({ productIds: (list?.productIds ?? []).map(id => String(id)) });
  } catch (error) { next(error); }
});

app.post('/api/v1/users/me/wishlist/toggle', requireAuth, requireRoles('CUSTOMER'), async (req, res, next) => {
  try {
    const input = z.object({ productId: z.string().refine(mongoose.isValidObjectId) }).parse(req.body);
    let list = await Wishlist.findOne({ userId: req.identity!.id });
    if (!list) {
      list = new Wishlist({ userId: req.identity!.id, productIds: [new mongoose.Types.ObjectId(input.productId)] });
      await list.save();
      res.json({ productIds: [input.productId], added: true });
      return;
    }
    const pId = new mongoose.Types.ObjectId(input.productId);
    const existingIdx = list.productIds.findIndex(id => id.equals(pId));
    let added = false;
    if (existingIdx >= 0) {
      list.productIds.splice(existingIdx, 1);
      added = false;
    } else {
      list.productIds.push(pId);
      added = true;
    }
    await list.save();
    res.json({ productIds: list.productIds.map(id => String(id)), added });
  } catch (error) { next(error); }
});

const cartItemsSchema = z.array(z.object({ productId: z.string().refine(mongoose.isValidObjectId), quantity: z.number().int().min(1).max(20) }).strict()).max(30).refine(items => new Set(items.map(item => item.productId)).size === items.length, 'Duplicate products are not allowed');
app.get('/api/v1/cart', requireAuth, requireRoles('CUSTOMER'), async (req, res, next) => {
  try {
    let items: Array<{ productId: string; quantity: number }> | null = null;
    const cached = await readCartCache(req.identity!.id);
    if (cached) { try { items = cartItemsSchema.parse(JSON.parse(cached)); } catch { items = null; } }
    let source = 'redis';
    if (!items) {
      const cart = await Cart.findOne({ userId: req.identity!.id }).lean();
      items = (cart?.items ?? []).map(item => ({ productId: String(item.productId), quantity: item.quantity }));
      source = 'mongodb';
      await writeCartCache(req.identity!.id, JSON.stringify(items));
    }
    const products = await Product.find({ _id: { $in: items.map(item => item.productId) }, status: 'PUBLISHED' }).lean();
    const byId = new Map(products.map(product => [String(product._id), product]));
    res.json({ items: items.flatMap(item => { const product = byId.get(item.productId); return product ? [{ product, quantity: item.quantity }] : []; }), source });
  } catch (error) { next(error); }
});
app.put('/api/v1/cart', requireAuth, requireRoles('CUSTOMER'), async (req, res, next) => {
  try {
    const items = cartItemsSchema.parse(req.body.items);
    const products = await Product.find({ _id: { $in: items.map(item => item.productId) }, status: 'PUBLISHED' }).select('_id stock').lean();
    if (products.length !== items.length) { res.status(409).json({ error: { code: 'PRODUCT_UNAVAILABLE', message: 'One or more products are unavailable' } }); return; }
    const stocks = new Map(products.map(product => [String(product._id), product.stock]));
    if (items.some(item => item.quantity > (stocks.get(item.productId) ?? -1))) { res.status(409).json({ error: { code: 'INSUFFICIENT_STOCK', message: 'Requested quantity exceeds available stock' } }); return; }
    await Cart.findOneAndUpdate({ userId: req.identity!.id }, { $set: { userId: req.identity!.id, items } }, { upsert: true, new: true, runValidators: true });
    const cache = await writeCartCache(req.identity!.id, JSON.stringify(items));
    res.json({ items, cache: cache ? 'redis' : 'mongodb-fallback' });
  } catch (error) { next(error); }
});

const checkoutSchema = z.object({
  addressId: z.string().refine(mongoose.isValidObjectId),
  items: z.array(z.object({ productId: z.string().refine(mongoose.isValidObjectId), quantity: z.number().int().min(1).max(20) }).strict()).min(1).max(30).refine(items => new Set(items.map(item => item.productId)).size === items.length, 'Duplicate product lines are not allowed'),
  couponCode: z.string().trim().optional(),
}).strict();
app.post('/api/v1/checkout', requireAuth, requireRoles('CUSTOMER'), async (req, res, next) => {
  const reserved: Array<{ id: string; quantity: number }> = [];
  let createdOrderId: mongoose.Types.ObjectId | undefined;
  try {
    const key = String(req.get('idempotency-key') ?? '');
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key)) { res.status(400).json({ error: { code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Supply an Idempotency-Key between 8 and 128 safe characters' } }); return; }
    const previous = await Order.findOne({ customerId: req.identity!.id, idempotencyKey: key });
    if (previous) {
      const priorPayment = await Payment.findOne({ orderId: previous._id }).lean();
      res.json({ order: previous, replayed: true, payment: priorPayment ? { provider: priorPayment.provider, reference: priorPayment.providerReference, ...(priorPayment.provider === 'razorpay' ? { keyId: config.RAZORPAY_KEY_ID } : {}), status: priorPayment.status, amountPaise: priorPayment.amountPaise, currency: 'INR' } : undefined }); return;
    }
    const input = checkoutSchema.parse(req.body);
    const address = await Address.findOne({ _id: input.addressId, userId: req.identity!.id }).lean();
    if (!address) { res.status(400).json({ error: { code: 'INVALID_ADDRESS', message: 'Choose one of your saved shipping addresses' } }); return; }
    const products = await Product.find({ _id: { $in: input.items.map(item => item.productId) }, status: 'PUBLISHED' }).lean();
    if (products.length !== input.items.length) { res.status(409).json({ error: { code: 'PRODUCT_UNAVAILABLE', message: 'One or more products are no longer available' } }); return; }
    const vendors = await VendorProfile.find({ userId: { $in: products.map(product => product.vendorId) }, status: 'APPROVED' }).select('userId razorpayLinkedAccountId').lean();
    const approvedVendorIds = new Set(vendors.map(profile => String(profile.userId)));
    if (products.some(product => !approvedVendorIds.has(String(product.vendorId)))) { res.status(409).json({ error: { code: 'VENDOR_UNAVAILABLE', message: 'A seller is not currently approved to sell' } }); return; }
    const profileByVendor = new Map(vendors.map(profile => [String(profile.userId), profile]));
    if (config.PAYMENT_PROVIDER === 'razorpay' && products.some(product => !profileByVendor.get(String(product.vendorId))?.razorpayLinkedAccountId)) { res.status(409).json({ error: { code: 'VENDOR_PAYMENT_NOT_READY', message: 'A seller is missing its approved Razorpay Route linked account' } }); return; }
    const productById = new Map(products.map(product => [String(product._id), product]));
    const lines = input.items.map(item => ({ requested: item, product: productById.get(item.productId)! }));
    const totals = calculateTotals(lines.map(line => ({ unitPricePaise: line.product.pricePaise, quantity: line.requested.quantity })), config.PLATFORM_COMMISSION_BPS);
    
    let discountPaise = 0;
    let appliedCouponCode = '';
    if (input.couponCode) {
      const coupon = await Coupon.findOne({ code: input.couponCode.toUpperCase(), isActive: true });
      if (coupon && (!coupon.expiresAt || coupon.expiresAt > new Date()) && totals.subtotalPaise >= coupon.minOrderPaise) {
        appliedCouponCode = coupon.code;
        if (coupon.discountType === 'PERCENTAGE') {
          discountPaise = Math.floor(totals.subtotalPaise * coupon.discountValue / 100);
          if (coupon.maxDiscountPaise > 0) discountPaise = Math.min(discountPaise, coupon.maxDiscountPaise);
        } else if (coupon.discountType === 'FLAT') {
          discountPaise = Math.min(totals.subtotalPaise, coupon.discountValue);
        }
      }
    }
    const finalTotalPaise = Math.max(0, totals.subtotalPaise - discountPaise);

    const orderItems = lines.map(({ requested, product }) => {
      const lineTotal = product.pricePaise * requested.quantity;
      const commission = Math.floor(lineTotal * config.PLATFORM_COMMISSION_BPS / 10000);
      return { productId: product._id, vendorId: product.vendorId, name: product.name, imageUrl: product.imageUrl || '', quantity: requested.quantity, unitPricePaise: product.pricePaise, commissionPaise: commission, vendorPayablePaise: lineTotal - commission, fulfillmentStatus: 'UNFULFILLED' as const };
    });
    for (const line of lines) {
      const updated = await Product.findOneAndUpdate({ _id: line.product._id, status: 'PUBLISHED', stock: { $gte: line.requested.quantity } }, { $inc: { stock: -line.requested.quantity } }, { new: true });
      if (!updated) {
        await Promise.all(reserved.map(item => Product.updateOne({ _id: item.id }, { $inc: { stock: item.quantity } })));
        reserved.length = 0;
        res.status(409).json({ error: { code: 'INSUFFICIENT_STOCK', message: `${line.product.name} no longer has enough stock` } }); return;
      }
      reserved.push({ id: String(line.product._id), quantity: line.requested.quantity });
    }
    const orderId = new mongoose.Types.ObjectId();
    createdOrderId = orderId;
    const pendingReference = `pending_${randomUUID()}`;
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}-${orderId.toString().slice(-4).toUpperCase()}`;
    const order = new Order({ _id: orderId, customerId: req.identity!.id, idempotencyKey: key, items: orderItems, addressSnapshot: { label: address.label, recipient: address.recipient, phone: address.phone, line1: address.line1, line2: address.line2, city: address.city, state: address.state, postalCode: address.postalCode, country: address.country }, subtotalPaise: totals.subtotalPaise, couponCode: appliedCouponCode, discountPaise, totalPaise: finalTotalPaise, commissionPaise: totals.commissionPaise, status: 'PAYMENT_PENDING', paymentStatus: 'PENDING', paymentReference: pendingReference, invoiceNumber });
    await order.save();
    const transfersByVendor = new Map<string, { amountPaise: number; accountId: string }>();
    for (const item of orderItems) {
      const vendorKey = String(item.vendorId), profile = profileByVendor.get(vendorKey);
      const transfer = transfersByVendor.get(vendorKey) ?? { amountPaise: 0, accountId: profile?.razorpayLinkedAccountId ?? '' };
      transfer.amountPaise += item.vendorPayablePaise; transfersByVendor.set(vendorKey, transfer);
    }
    const paymentAttempt = await createPaymentAttempt({ amountPaise: finalTotalPaise, receipt: String(orderId), transfers: [...transfersByVendor].filter(([, value]) => value.amountPaise > 0).map(([vendorId, value]) => ({ vendorId, accountId: value.accountId, amountPaise: value.amountPaise })) });
    order.paymentReference = paymentAttempt.reference; await order.save();
    await Payment.create({ orderId, provider: paymentAttempt.provider, providerReference: paymentAttempt.reference, eventId: `attempt:${paymentAttempt.reference}`, status: 'PENDING', amountPaise: finalTotalPaise });
    res.status(201).json({ order, payment: { ...paymentAttempt, status: 'PENDING', amountPaise: finalTotalPaise, currency: 'INR' } });
  } catch (error) {
    if (createdOrderId) { await Promise.all([Order.deleteOne({ _id: createdOrderId }), Payment.deleteMany({ orderId: createdOrderId })]); }
    if (reserved.length) await Promise.all(reserved.map(item => Product.updateOne({ _id: item.id }, { $inc: { stock: item.quantity } })));
    if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) {
      const key = String(req.get('idempotency-key') ?? '');
      const previous = await Order.findOne({ customerId: req.identity!.id, idempotencyKey: key });
      if (previous) {
        const priorPayment = await Payment.findOne({ orderId: previous._id }).lean();
        res.json({ order: previous, replayed: true, payment: priorPayment ? { provider: priorPayment.provider, reference: priorPayment.providerReference, ...(priorPayment.provider === 'razorpay' ? { keyId: config.RAZORPAY_KEY_ID } : {}), status: priorPayment.status, amountPaise: priorPayment.amountPaise, currency: 'INR' } : undefined }); return;
      }
    }
    next(error);
  }
});

const mockWebhookSchema = z.object({ eventId: z.string().min(8).max(120), orderId: z.string().refine(mongoose.isValidObjectId), reference: z.string().min(8).max(120), status: z.enum(['paid', 'failed']) }).strict();
app.post('/api/v1/payments/mock/webhook', async (req, res, next) => {
  try {
    if (config.NODE_ENV === 'production' || config.PAYMENT_PROVIDER !== 'mock') { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } }); return; }
    const signature = req.get('x-mock-signature') ?? '';
    if (!verifyMockPaymentEvent(req.body, signature, config.MOCK_PAYMENT_WEBHOOK_SECRET)) { res.status(401).json({ error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature is invalid' } }); return; }
    const input = mockWebhookSchema.parse(req.body);
    const priorEvent = await Payment.findOne({ eventId: input.eventId });
    const order = await Order.findOne({ _id: input.orderId, paymentReference: input.reference });
    if (!order) { res.status(404).json({ error: { code: 'ORDER_NOT_FOUND', message: 'Payment order not found' } }); return; }
    const addLedgerCredits = async (eventId: string) => Promise.all(order.items.map(item => VendorLedgerEntry.updateOne({ eventKey: `${eventId}:${item._id}` }, { $setOnInsert: { vendorId: item.vendorId, orderId: order._id, orderItemId: item._id, eventKey: `${eventId}:${item._id}`, amountPaise: item.vendorPayablePaise, type: 'SALE_CREDIT', status: 'PAYABLE' } }, { upsert: true })));
    if (!priorEvent) await Payment.create({ orderId: order._id, provider: 'mock', providerReference: input.reference, eventId: input.eventId, status: input.status === 'paid' ? 'PAID' : 'FAILED', amountPaise: order.totalPaise, signatureVerifiedAt: new Date() });
    if (order.paymentStatus !== 'PENDING') {
      if (input.status === 'paid' && order.paymentEventId === input.eventId) await addLedgerCredits(input.eventId);
      res.json({ received: true, duplicate: Boolean(priorEvent || order.paymentEventId === input.eventId), ignored: order.paymentEventId !== input.eventId }); return;
    }
    const paymentStatus = input.status === 'paid' ? 'PAID' : 'FAILED';
    const orderStatus = input.status === 'paid' ? 'PLACED' : 'CANCELLED';
    const claimedOrder = await Order.findOneAndUpdate({ _id: order._id, status: 'PAYMENT_PENDING', paymentStatus: 'PENDING', paymentEventId: null }, { $set: { status: orderStatus, paymentStatus, paymentEventId: input.eventId } }, { new: true });
    if (!claimedOrder) {
      const current = await Order.findById(order._id);
      if (current?.paymentEventId === input.eventId && input.status === 'paid') await Promise.all(current.items.map(item => VendorLedgerEntry.updateOne({ eventKey: `${input.eventId}:${item._id}` }, { $setOnInsert: { vendorId: item.vendorId, orderId: current._id, orderItemId: item._id, eventKey: `${input.eventId}:${item._id}`, amountPaise: item.vendorPayablePaise, type: 'SALE_CREDIT', status: 'PAYABLE' } }, { upsert: true })));
      res.json({ received: true, duplicate: Boolean(current?.paymentEventId === input.eventId), ignored: current?.paymentEventId !== input.eventId }); return;
    }
    if (input.status === 'paid') {
      await addLedgerCredits(input.eventId);
      await Cart.updateOne({ userId: order.customerId }, { $set: { items: [] } });
      await clearCartCache(String(order.customerId));
    } else {
      await Promise.all(order.items.map(item => Product.updateOne({ _id: item.productId }, { $inc: { stock: item.quantity } })));
    }
    res.json({ received: true, orderId: String(claimedOrder._id), status: claimedOrder.status });
  } catch (error) { next(error); }
});

app.post('/api/v1/payments/mock/confirm', requireAuth, requireRoles('CUSTOMER'), async (req, res, next) => {
  try {
    if (config.NODE_ENV === 'production' || config.PAYMENT_PROVIDER !== 'mock') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
      return;
    }
    const input = z.object({ orderId: z.string().refine(mongoose.isValidObjectId) }).parse(req.body);
    const order = await Order.findOne({ _id: input.orderId, customerId: req.identity!.id, status: 'PAYMENT_PENDING' });
    if (!order) {
      res.status(404).json({ error: { code: 'ORDER_NOT_FOUND', message: 'Pending order not found' } });
      return;
    }
    const eventId = `evt_mock_${randomUUID()}`;
    await Payment.create({
      orderId: order._id,
      provider: 'mock',
      providerReference: order.paymentReference,
      eventId,
      status: 'PAID',
      amountPaise: order.totalPaise,
      signatureVerifiedAt: new Date(),
    });
    order.status = 'PLACED';
    order.paymentStatus = 'PAID';
    order.paymentEventId = eventId;
    await order.save();

    await Promise.all(order.items.map(item =>
      VendorLedgerEntry.updateOne(
        { eventKey: `${eventId}:${item._id}` },
        { $setOnInsert: { vendorId: item.vendorId, orderId: order._id, orderItemId: item._id, eventKey: `${eventId}:${item._id}`, amountPaise: item.vendorPayablePaise, type: 'SALE_CREDIT', status: 'PAYABLE' } },
        { upsert: true }
      )
    ));
    await Cart.updateOne({ userId: order.customerId }, { $set: { items: [] } });
    await clearCartCache(String(order.customerId));

    res.json({ success: true, orderId: String(order._id), status: order.status, paymentStatus: order.paymentStatus });
  } catch (error) { next(error); }
});

app.post('/api/v1/payments/razorpay/webhook', async (req, res, next) => {
  try {
    if (config.PAYMENT_PROVIDER !== 'razorpay') { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } }); return; }
    const rawBody = req.rawBody;
    const signature = req.get('x-razorpay-signature') ?? '';
    if (!rawBody || !config.RAZORPAY_WEBHOOK_SECRET || !verifyRazorpayWebhook(rawBody, signature, config.RAZORPAY_WEBHOOK_SECRET)) { res.status(401).json({ error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature is invalid' } }); return; }
    const event = req.body as { event?: string; payload?: { payment?: { entity?: { id?: string; order_id?: string; amount?: number; currency?: string } } } };
    if (event.event !== 'payment.captured') { res.json({ received: true, ignored: true }); return; }
    const payment = event.payload?.payment?.entity;
    if (!payment?.id || !payment.order_id || !Number.isInteger(payment.amount) || payment.currency !== 'INR') { res.status(400).json({ error: { code: 'INVALID_EVENT', message: 'Captured payment payload is incomplete' } }); return; }
    const attempt = await Payment.findOne({ provider: 'razorpay', providerReference: payment.order_id });
    if (!attempt) {
      const duplicate = await Payment.findOne({ provider: 'razorpay', eventId: req.get('x-razorpay-event-id') ?? `${event.event}:${payment.id}` });
      if (duplicate) { res.json({ received: true, duplicate: true }); return; }
      res.status(404).json({ error: { code: 'PAYMENT_NOT_FOUND', message: 'Payment order was not found' } }); return;
    }
    const order = await Order.findOne({ _id: attempt.orderId, paymentReference: payment.order_id });
    if (!order) { res.status(404).json({ error: { code: 'ORDER_NOT_FOUND', message: 'Payment order was not found' } }); return; }
    if (payment.amount !== order.totalPaise) { res.status(400).json({ error: { code: 'PAYMENT_AMOUNT_MISMATCH', message: 'Captured amount does not match the order' } }); return; }
    const eventId = (req.get('x-razorpay-event-id') ?? `${event.event}:${payment.id}`).slice(0, 120);
    const addLedgerCredits = async () => Promise.all(order.items.map(item => VendorLedgerEntry.updateOne({ eventKey: `${eventId}:${item._id}` }, { $setOnInsert: { vendorId: item.vendorId, orderId: order._id, orderItemId: item._id, eventKey: `${eventId}:${item._id}`, amountPaise: item.vendorPayablePaise, type: 'SALE_CREDIT', status: 'PAYABLE' } }, { upsert: true })));
    const claimedOrder = await Order.findOneAndUpdate({ _id: order._id, status: 'PAYMENT_PENDING', paymentStatus: 'PENDING', paymentEventId: null }, { $set: { status: 'PLACED', paymentStatus: 'PAID', paymentEventId: eventId } }, { new: true });
    if (!claimedOrder) {
      const current = await Order.findById(order._id);
      if (current?.paymentEventId === eventId) {
        await Payment.updateOne({ _id: attempt._id }, { $set: { eventId, status: 'PAID', signatureVerifiedAt: new Date() } });
        await addLedgerCredits();
        await Cart.updateOne({ userId: order.customerId }, { $set: { items: [] } });
        await clearCartCache(String(order.customerId));
        res.json({ received: true, duplicate: true }); return;
      }
      res.json({ received: true, ignored: true }); return;
    }
    await Payment.updateOne({ _id: attempt._id }, { $set: { eventId, status: 'PAID', signatureVerifiedAt: new Date() } });
    await addLedgerCredits();
    await Cart.updateOne({ userId: order.customerId }, { $set: { items: [] } });
    await clearCartCache(String(order.customerId));
    res.json({ received: true, orderId: String(claimedOrder._id), status: claimedOrder.status });
  } catch (error) { next(error); }
});

app.get('/api/v1/orders', requireAuth, requireRoles('CUSTOMER'), async (req, res, next) => {
  try { res.json({ items: await Order.find({ customerId: req.identity!.id }).sort({ createdAt: -1 }).limit(100).lean() }); } catch (error) { next(error); }
});
app.get('/api/v1/orders/:id', requireAuth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order not found' } }); return; }
    const order = await Order.findOne({ _id: req.params.id, customerId: req.identity!.id }).lean();
    if (!order) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order not found' } }); return; }
    res.json({ order });
  } catch (error) { next(error); }
});

app.post('/api/v1/orders/:id/cancel', requireAuth, requireRoles('CUSTOMER'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order not found' } }); return; }
    const order = await Order.findOne({ _id: req.params.id, customerId: req.identity!.id });
    if (!order) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order not found' } }); return; }
    if (!['PLACED', 'PAYMENT_PENDING'].includes(order.status)) {
      res.status(400).json({ error: { code: 'CANNOT_CANCEL', message: `Order with status ${order.status} cannot be cancelled directly.` } });
      return;
    }
    if (order.items.some(i => ['SHIPPED', 'DELIVERED'].includes(i.fulfillmentStatus))) {
      res.status(400).json({ error: { code: 'CANNOT_CANCEL', message: 'One or more items in your order have already shipped.' } });
      return;
    }
    order.status = 'CANCELLED';
    order.paymentStatus = 'REFUNDED';
    for (const item of order.items) {
      item.fulfillmentStatus = 'CANCELLED';
    }
    await order.save();

    await Promise.all(order.items.map(item => Product.updateOne({ _id: item.productId }, { $inc: { stock: item.quantity } })));
    await VendorLedgerEntry.updateMany({ orderId: order._id, status: 'PAYABLE' }, { $set: { status: 'REVERSED' } });

    await AuditLog.create({
      actorId: req.identity!.id,
      action: 'ORDER_CANCELLED',
      resourceType: 'ORDER',
      resourceId: String(order._id),
      summary: `Order ${order._id} cancelled by customer and refunded`,
      requestId: String(res.getHeader('x-request-id') || 'system'),
    });

    res.json({ success: true, orderId: String(order._id), status: order.status, paymentStatus: order.paymentStatus });
  } catch (error) { next(error); }
});
app.get('/api/v1/vendor/orders', requireAuth, requireRoles('VENDOR'), requireApprovedVendor, async (req, res, next) => {
  try {
    const orders = await Order.find({ items: { $elemMatch: { vendorId: req.identity!.id } } }).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ items: orders.map(order => ({ _id: order._id, status: order.status, paymentStatus: order.paymentStatus, createdAt: order.createdAt, totalPaise: order.items.filter(item => String(item.vendorId) === req.identity!.id).reduce((sum, item) => sum + item.unitPricePaise * item.quantity, 0), items: order.items.filter(item => String(item.vendorId) === req.identity!.id) })) });
  } catch (error) { next(error); }
});
app.patch('/api/v1/vendor/orders/:orderId/items/:itemId/fulfillment', requireAuth, requireRoles('VENDOR'), requireApprovedVendor, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.orderId) || !mongoose.isValidObjectId(req.params.itemId)) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order item not found' } }); return; }
    const orderId = String(req.params.orderId), itemId = String(req.params.itemId);
    const input = z.object({
      status: z.enum(['PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
      trackingNumber: z.string().trim().optional(),
      courier: z.string().trim().optional(),
    }).strict().parse(req.body);
    const order = await Order.findOne({ _id: orderId, items: { $elemMatch: { _id: itemId, vendorId: req.identity!.id } } });
    if (!order) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order item not found' } }); return; }
    const item = order.items.id(itemId);
    if (!item) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order item not found' } }); return; }
    
    const prevStatus = item.fulfillmentStatus;
    item.fulfillmentStatus = input.status;
    if (input.trackingNumber) (item as any).trackingNumber = input.trackingNumber;
    if (input.courier) (item as any).courier = input.courier;

    if (input.status === 'CANCELLED' && prevStatus !== 'CANCELLED') {
      await Product.updateOne({ _id: item.productId }, { $inc: { stock: item.quantity } });
      await VendorLedgerEntry.updateOne({ orderId: order._id, orderItemId: item._id, status: 'PAYABLE' }, { $set: { status: 'REVERSED' } });
    }

    const nonCancelled = order.items.filter(i => i.fulfillmentStatus !== 'CANCELLED');
    if (nonCancelled.length === 0) {
      order.status = 'CANCELLED';
      order.paymentStatus = 'REFUNDED';
    } else if (nonCancelled.every(s => s.fulfillmentStatus === 'DELIVERED')) {
      order.status = 'DELIVERED';
    } else if (nonCancelled.every(s => s.fulfillmentStatus === 'SHIPPED' || s.fulfillmentStatus === 'DELIVERED')) {
      order.status = 'SHIPPED';
    } else if (nonCancelled.some(s => ['PACKED', 'SHIPPED', 'DELIVERED'].includes(s.fulfillmentStatus))) {
      order.status = 'PACKED';
    }

    await order.save();
    res.json({ item, orderStatus: order.status });
  } catch (error) { next(error); }
});

// --- Media Upload (S3 / Local Fallback) ---
app.post('/api/v1/upload', requireAuth, async (req, res, next) => {
  try {
    const input = z.object({
      dataUrl: z.string().min(10),
      filename: z.string().trim().optional(),
    }).parse(req.body);
    const result = await saveBase64Image(input.dataUrl, input.filename || 'product-upload.jpg');
    res.status(201).json(result);
  } catch (error) { next(error); }
});

// --- Reviews & Ratings ---
app.get('/api/v1/products/:id/reviews', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Product not found' } }); return; }
    const reviews = await Review.find({ productId: req.params.id }).sort({ createdAt: -1 }).limit(50).lean();
    res.json({ items: reviews, total: reviews.length });
  } catch (error) { next(error); }
});

app.post('/api/v1/products/:id/reviews', requireAuth, requireRoles('CUSTOMER'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Product not found' } }); return; }
    const input = z.object({
      rating: z.coerce.number().int().min(1).max(5),
      headline: z.string().trim().max(140).optional(),
      comment: z.string().trim().min(3).max(2500),
    }).parse(req.body);

    const product = await Product.findById(req.params.id);
    if (!product) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Product not found' } }); return; }

    const review = await Review.findOneAndUpdate(
      { customerId: req.identity!.id, productId: req.params.id },
      {
        $set: {
          customerName: req.identity!.name,
          rating: input.rating,
          headline: input.headline ?? '',
          comment: input.comment,
          verifiedPurchase: true,
        },
      },
      { upsert: true, new: true }
    );

    // Recalculate average rating
    const stats = await Review.aggregate([
      { $match: { productId: new mongoose.Types.ObjectId(String(req.params.id)) } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);

    if (stats.length) {
      product.ratingAverage = Number(stats[0].avg.toFixed(1));
      product.ratingCount = stats[0].count;
      await product.save();
      await queueProductIndex(String(product._id));
    }

    res.status(201).json({ review, productRating: { average: product.ratingAverage, count: product.ratingCount } });
  } catch (error) { next(error); }
});

// --- Coupons System ---
app.get('/api/v1/coupons', async (_req, res, next) => {
  try {
    const coupons = await Coupon.find({ isActive: true }).select('code description discountType discountValue minOrderPaise').lean();
    res.json({ items: coupons });
  } catch (error) { next(error); }
});

app.post('/api/v1/coupons/apply', async (req, res, next) => {
  try {
    const input = z.object({
      code: z.string().trim().min(1),
      subtotalPaise: z.number().int().min(0),
    }).parse(req.body);

    const coupon = await Coupon.findOne({ code: input.code.toUpperCase(), isActive: true });
    if (!coupon) {
      res.status(404).json({ error: { code: 'COUPON_NOT_FOUND', message: 'Invalid or inactive promotional code' } });
      return;
    }
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      res.status(400).json({ error: { code: 'COUPON_EXPIRED', message: 'This promo code has expired' } });
      return;
    }
    if (input.subtotalPaise < coupon.minOrderPaise) {
      res.status(400).json({ error: { code: 'MIN_ORDER_NOT_MET', message: `Minimum order of ₹${(coupon.minOrderPaise / 100).toFixed(0)} required for this coupon` } });
      return;
    }

    let discountPaise = 0;
    if (coupon.discountType === 'PERCENTAGE') {
      discountPaise = Math.floor(input.subtotalPaise * coupon.discountValue / 100);
      if (coupon.maxDiscountPaise > 0) discountPaise = Math.min(discountPaise, coupon.maxDiscountPaise);
    } else {
      discountPaise = Math.min(input.subtotalPaise, coupon.discountValue);
    }

    res.json({
      valid: true,
      coupon: { code: coupon.code, description: coupon.description, discountType: coupon.discountType, discountValue: coupon.discountValue },
      discountPaise,
      newTotalPaise: Math.max(0, input.subtotalPaise - discountPaise),
    });
  } catch (error) { next(error); }
});

app.get('/api/v1/admin/coupons', requireAuth, requireRoles('ADMIN'), async (_req, res, next) => {
  try { res.json({ items: await Coupon.find().sort({ createdAt: -1 }).lean() }); } catch (error) { next(error); }
});

app.post('/api/v1/admin/coupons', requireAuth, requireRoles('ADMIN'), async (req, res, next) => {
  try {
    const input = z.object({
      code: z.string().trim().min(3).max(30).toUpperCase(),
      description: z.string().trim().min(3).max(200),
      discountType: z.enum(['PERCENTAGE', 'FLAT']),
      discountValue: z.number().int().min(1),
      minOrderPaise: z.number().int().min(0).default(0),
      maxDiscountPaise: z.number().int().min(0).default(0),
      isActive: z.boolean().default(true),
    }).parse(req.body);

    const coupon = await Coupon.create(input);
    res.status(201).json({ coupon });
  } catch (error) { next(error); }
});

// --- Tax Invoices ---
app.get('/api/v1/orders/:id/invoice', requireAuth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) { res.status(404).send('Order not found'); return; }
    const order = await Order.findById(req.params.id);
    if (!order) { res.status(404).send('Order not found'); return; }

    const isCustomer = String(order.customerId) === req.identity!.id;
    const isVendor = order.items.some(item => String(item.vendorId) === req.identity!.id);
    const isAdmin = req.identity!.role === 'ADMIN';

    if (!isCustomer && !isVendor && !isAdmin) {
      res.status(403).send('Unauthorized to access this invoice');
      return;
    }

    // Lookup primary vendor profile for invoice details
    const vendorProfile = await VendorProfile.findOne({ userId: order.items[0]?.vendorId }).lean();
    const customerUser = await User.findById(order.customerId).lean();

    const invoiceHtml = renderInvoiceHtml({
      invoiceNumber: (order as any).invoiceNumber || `INV-${order._id.toString().slice(-8).toUpperCase()}`,
      orderId: String(order._id),
      orderDate: (order as any).createdAt || new Date(),
      customer: {
        name: customerUser?.name || order.addressSnapshot.recipient,
        email: customerUser?.email || '',
        phone: order.addressSnapshot.phone,
        address: order.addressSnapshot,
      },
      vendor: {
        shopName: vendorProfile?.shopName || 'Marketplace Artisan Partner',
        slug: vendorProfile?.slug,
      },
      items: order.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        unitPricePaise: item.unitPricePaise,
        totalPaise: item.unitPricePaise * item.quantity,
      })),
      subtotalPaise: order.subtotalPaise,
      discountPaise: (order as any).discountPaise || 0,
      totalPaise: order.totalPaise,
      paymentReference: order.paymentReference,
      paymentStatus: order.paymentStatus,
    });

    res.setHeader('Content-Type', 'text/html');
    res.send(invoiceHtml);
  } catch (error) { next(error); }
});
app.get('/api/v1/vendor/ledger', requireAuth, requireRoles('VENDOR'), requireApprovedVendor, async (req, res, next) => {
  try {
    const entries = await VendorLedgerEntry.find({ vendorId: req.identity!.id }).sort({ createdAt: -1 }).limit(250).lean();
    const payablePaise = entries.reduce((sum, entry) => sum + (entry.status === 'PAYABLE' ? entry.amountPaise : 0), 0);
    res.json({ entries, payablePaise, settlementStatus: 'RECORDED_PAYABLE_NOT_SETTLED' });
  } catch (error) { next(error); }
});
app.get('/api/v1/admin/analytics/summary', requireAuth, requireRoles('ADMIN'), async (req, res, next) => {
  try {
    const range = z.object({ from: z.iso.datetime().optional(), to: z.iso.datetime().optional() }).refine(value => !value.from || !value.to || value.from <= value.to, 'from must be before or equal to to').parse(req.query);
    const createdAt: Record<string, Date> = {};
    if (range.from) createdAt.$gte = new Date(range.from);
    if (range.to) createdAt.$lte = new Date(range.to);
    const match = { paymentStatus: 'PAID', ...(Object.keys(createdAt).length ? { createdAt } : {}) };
    const [orders, statusDistribution, bestSellers, vendorSales] = await Promise.all([
      Order.aggregate([{ $match: match }, { $group: { _id: null, orderCount: { $sum: 1 }, gmvPaise: { $sum: '$totalPaise' }, commissionPaise: { $sum: '$commissionPaise' }, revenueSubtotalPaise: { $sum: '$subtotalPaise' } } }]),
      Order.aggregate([{ $match: range.from || range.to ? { ...(range.from ? { createdAt: { ...(range.from ? { $gte: new Date(range.from) } : {}), ...(range.to ? { $lte: new Date(range.to) } : {}) } } : {}) } : {} }, { $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Order.aggregate([{ $match: match }, { $unwind: '$items' }, { $group: { _id: '$items.productId', name: { $first: '$items.name' }, units: { $sum: '$items.quantity' }, grossPaise: { $sum: { $multiply: ['$items.unitPricePaise', '$items.quantity'] } } } }, { $sort: { units: -1 } }, { $limit: 10 }]),
      Order.aggregate([{ $match: match }, { $unwind: '$items' }, { $group: { _id: '$items.vendorId', itemSalesPaise: { $sum: { $multiply: ['$items.unitPricePaise', '$items.quantity'] } }, payablePaise: { $sum: '$items.vendorPayablePaise' }, commissionPaise: { $sum: '$items.commissionPaise' } } }, { $sort: { itemSalesPaise: -1 } }, { $limit: 50 }]),
    ]);
    const summary = orders[0] ?? { orderCount: 0, gmvPaise: 0, commissionPaise: 0, revenueSubtotalPaise: 0 };
    res.json({ definitions: { gmvPaise: 'Paid order totals, including any configured shipping/tax (none currently configured)', commissionPaise: 'Recorded platform commission at checkout before reversals/refunds', averageOrderValuePaise: 'Paid GMV divided by paid order count' }, summary: { ...summary, averageOrderValuePaise: summary.orderCount ? Math.round(summary.gmvPaise / summary.orderCount) : 0 }, statusDistribution, bestSellers, vendorSales });
  } catch (error) { next(error); }
});
app.get('/api/v1/admin/audit-logs', requireAuth, requireRoles('ADMIN'), async (req, res, next) => {
  try { res.json({ items: await AuditLog.find().sort({ createdAt: -1 }).limit(100).lean() }); } catch (error) { next(error); }
});

function escapeRegex(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof z.ZodError) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Check the submitted fields', details: error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message })) } }); return; }
  const status = (error as { status?: number }).status;
  if (status && status >= 400 && status < 500) { res.status(status).json({ error: { code: 'REQUEST_ERROR', message: 'The request could not be processed' } }); return; }
  console.error('request_failed', { requestId: res.getHeader('x-request-id'), error: error instanceof Error ? error.message : 'unknown' });
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
});
