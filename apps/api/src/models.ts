import mongoose, { Schema } from 'mongoose';

export type Role = 'CUSTOMER' | 'VENDOR' | 'ADMIN';
const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['CUSTOMER', 'VENDOR', 'ADMIN'], default: 'CUSTOMER', required: true },
  status: { type: String, enum: ['ACTIVE', 'SUSPENDED'], default: 'ACTIVE' },
}, { timestamps: true, strict: 'throw' });

const refreshSessionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  revokedAt: { type: Date, default: null },
}, { timestamps: true });

const productSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  slug: { type: String, required: true, unique: true, lowercase: true, index: true },
  description: { type: String, required: true, maxlength: 6000 },
  category: { type: String, required: true, index: true },
  vendorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  pricePaise: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  mrpPaise: { type: Number, min: 1, default: null },
  badge: { type: String, default: '' },
  specs: { type: Schema.Types.Mixed, default: {} },
  stock: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
  ratingCount: { type: Number, default: 0, min: 0 },
  imageUrl: { type: String, default: '' },
  status: { type: String, enum: ['PENDING', 'PUBLISHED', 'ARCHIVED'], default: 'PUBLISHED', index: true },
}, { timestamps: true, strict: 'throw' });

const vendorProfileSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  shopName: { type: String, required: true, trim: true, maxlength: 100 },
  slug: { type: String, required: true, unique: true, lowercase: true },
  description: { type: String, required: true, maxlength: 2000 },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'], default: 'PENDING', index: true },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  rejectionReason: { type: String, maxlength: 500, default: '' },
  razorpayLinkedAccountId: { type: String, maxlength: 80, default: '' },
}, { timestamps: true, strict: 'throw' });

const auditLogSchema = new Schema({
  actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  action: { type: String, required: true, maxlength: 100 },
  resourceType: { type: String, required: true, maxlength: 80 },
  resourceId: { type: String, required: true },
  summary: { type: String, required: true, maxlength: 1000 },
  requestId: { type: String, required: true, maxlength: 100 },
}, { timestamps: true, strict: 'throw' });

const addressSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  label: { type: String, required: true, trim: true, maxlength: 40 },
  recipient: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, trim: true, maxlength: 20 },
  line1: { type: String, required: true, trim: true, maxlength: 200 },
  line2: { type: String, trim: true, maxlength: 200, default: '' },
  city: { type: String, required: true, trim: true, maxlength: 80 },
  state: { type: String, required: true, trim: true, maxlength: 80 },
  postalCode: { type: String, required: true, trim: true, maxlength: 12 },
  country: { type: String, required: true, trim: true, maxlength: 80, default: 'India' },
  isDefault: { type: Boolean, default: false },
}, { timestamps: true, strict: 'throw' });
addressSchema.index({ userId: 1, isDefault: 1 });

const cartSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  items: [{ _id: false, productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true }, quantity: { type: Number, required: true, min: 1, max: 20 } }],
}, { timestamps: true, strict: 'throw' });

const orderItemSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  vendorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPricePaise: { type: Number, required: true, min: 1 },
  commissionPaise: { type: Number, required: true, min: 0 },
  vendorPayablePaise: { type: Number, required: true, min: 0 },
  fulfillmentStatus: { type: String, enum: ['UNFULFILLED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'], default: 'UNFULFILLED' },
  trackingNumber: { type: String, default: '' },
  courier: { type: String, default: '' },
}, { _id: true, strict: 'throw' });
const orderSchema = new Schema({
  customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  idempotencyKey: { type: String, required: true },
  items: { type: [orderItemSchema], required: true, validate: (items: unknown[]) => items.length > 0 },
  addressSnapshot: { type: Schema.Types.Mixed, required: true },
  subtotalPaise: { type: Number, required: true, min: 0 },
  couponCode: { type: String, default: '' },
  discountPaise: { type: Number, required: true, default: 0, min: 0 },
  totalPaise: { type: Number, required: true, min: 0 },
  commissionPaise: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['PAYMENT_PENDING', 'PLACED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'], default: 'PAYMENT_PENDING', index: true },
  paymentStatus: { type: String, enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'], default: 'PENDING', index: true },
  paymentReference: { type: String, required: true },
  paymentEventId: { type: String, default: null },
  invoiceNumber: { type: String, default: '' },
}, { timestamps: true, strict: 'throw' });
orderSchema.index({ customerId: 1, idempotencyKey: 1 }, { unique: true });
orderSchema.index({ 'items.vendorId': 1, status: 1, createdAt: -1 });

const reviewSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  customerName: { type: String, required: true, trim: true, maxlength: 100 },
  rating: { type: Number, required: true, min: 1, max: 5 },
  headline: { type: String, default: '', trim: true, maxlength: 140 },
  comment: { type: String, required: true, trim: true, maxlength: 2500 },
  verifiedPurchase: { type: Boolean, default: true },
}, { timestamps: true, strict: 'throw' });
reviewSchema.index({ productId: 1, createdAt: -1 });
reviewSchema.index({ customerId: 1, productId: 1 }, { unique: true });

const couponSchema = new Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
  description: { type: String, required: true, trim: true, maxlength: 200 },
  discountType: { type: String, enum: ['PERCENTAGE', 'FLAT'], required: true },
  discountValue: { type: Number, required: true, min: 1 }, // percentage e.g. 15 for 15%, or paise for FLAT
  minOrderPaise: { type: Number, default: 0, min: 0 },
  maxDiscountPaise: { type: Number, default: 0, min: 0 }, // 0 = no cap
  isActive: { type: Boolean, default: true, index: true },
  expiresAt: { type: Date, default: null },
}, { timestamps: true, strict: 'throw' });

const ledgerSchema = new Schema({
  vendorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  orderItemId: { type: Schema.Types.ObjectId, required: true },
  eventKey: { type: String, required: true, unique: true },
  amountPaise: { type: Number, required: true, min: 0 },
  type: { type: String, enum: ['SALE_CREDIT', 'COMMISSION_DEBIT', 'REFUND_REVERSAL'], required: true },
  status: { type: String, enum: ['PAYABLE', 'SETTLED', 'REVERSED'], default: 'PAYABLE' },
}, { timestamps: true, strict: 'throw' });

const paymentSchema = new Schema({
  orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  provider: { type: String, enum: ['mock', 'razorpay'], required: true },
  providerReference: { type: String, required: true, index: true },
  eventId: { type: String, required: true, unique: true },
  status: { type: String, enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'], required: true },
  amountPaise: { type: Number, required: true, min: 0 },
  signatureVerifiedAt: { type: Date, default: null },
}, { timestamps: true, strict: 'throw' });

const outboxSchema = new Schema({
  eventKey: { type: String, required: true, unique: true },
  entityType: { type: String, enum: ['PRODUCT'], required: true },
  entityId: { type: Schema.Types.ObjectId, required: true, index: true },
  status: { type: String, enum: ['PENDING', 'PROCESSED', 'DEAD'], default: 'PENDING', index: true },
  attempts: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now, index: true },
  lastError: { type: String, maxlength: 500, default: '' },
}, { timestamps: true, strict: 'throw' });

export const User = mongoose.model('User', userSchema);
export const RefreshSession = mongoose.model('RefreshSession', refreshSessionSchema);
export const Product = mongoose.model('Product', productSchema);
export const VendorProfile = mongoose.model('VendorProfile', vendorProfileSchema);
export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export const Address = mongoose.model('Address', addressSchema);
export const Cart = mongoose.model('Cart', cartSchema);
export const Order = mongoose.model('Order', orderSchema);
export const VendorLedgerEntry = mongoose.model('VendorLedgerEntry', ledgerSchema);
export const Payment = mongoose.model('Payment', paymentSchema);
export const OutboxEvent = mongoose.model('OutboxEvent', outboxSchema);
export const Review = mongoose.model('Review', reviewSchema);
export const Coupon = mongoose.model('Coupon', couponSchema);
