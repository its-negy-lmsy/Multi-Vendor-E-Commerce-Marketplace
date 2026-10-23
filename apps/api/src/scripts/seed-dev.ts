import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { Product, User, VendorProfile } from '../models.js';

if (config.NODE_ENV === 'production') throw new Error('Development seed is disabled in production');
await mongoose.connect(config.MONGODB_URI);
const vendor = await User.findOneAndUpdate({ email: 'maker@fs01.local' }, { $setOnInsert: { name: 'Studio North', email: 'maker@fs01.local', passwordHash: await bcrypt.hash('MakerDemo!2026', 12), role: 'VENDOR' } }, { upsert: true, new: true });
await VendorProfile.findOneAndUpdate({ userId: vendor._id }, { $setOnInsert: { userId: vendor._id, shopName: 'Studio North', slug: 'studio-north-demo', description: 'A small independent studio making useful, lasting objects.', status: 'APPROVED' } }, { upsert: true });
const customer = await User.findOneAndUpdate({ email: 'customer@fs01.local' }, { $setOnInsert: { name: 'Demo Customer', email: 'customer@fs01.local', passwordHash: await bcrypt.hash('CustomerDemo!2026', 12), role: 'CUSTOMER' } }, { upsert: true, new: true });
if (config.DEMO_ADMIN_EMAIL && config.DEMO_ADMIN_PASSWORD) {
  await User.findOneAndUpdate({ email: config.DEMO_ADMIN_EMAIL.toLowerCase() }, { $setOnInsert: { name: 'Local Demo Admin', email: config.DEMO_ADMIN_EMAIL.toLowerCase(), passwordHash: await bcrypt.hash(config.DEMO_ADMIN_PASSWORD, 12), role: 'ADMIN' } }, { upsert: true });
}
const products = [
  ['Everyday Canvas Tote', 'everyday-canvas-tote', 'A sturdy, thoughtfully made canvas tote for market mornings and long afternoons.', 'Accessories', 149900, 24, '#d9b78c'],
  ['Ceramic Pour-over Set', 'ceramic-pour-over-set', 'A hand-finished brewer and cup set made for slower coffee rituals.', 'Home', 329900, 12, '#9fbdad'],
  ['Soft Form Notebook', 'soft-form-notebook', 'Lay-flat recycled paper notebook with a cloth-bound cover.', 'Stationery', 89900, 51, '#d6a1a1'],
  ['Sculpted Desk Lamp', 'sculpted-desk-lamp', 'Warm, focused light in a compact sculptural silhouette.', 'Home', 489900, 8, '#d2b967'],
];
for (const [name, slug, description, category, pricePaise, stock, color] of products) await Product.updateOne({ slug }, { $setOnInsert: { name, slug, description, category, vendorId: vendor._id, pricePaise, stock, imageUrl: `https://placehold.co/600x760/${String(color).slice(1)}/fff?text=${encodeURIComponent(String(name))}`, ratingAverage: 4.7, ratingCount: 18, status: 'PUBLISHED' } }, { upsert: true });
console.log(`Seeded ${products.length} products. Customer: customer@fs01.local / CustomerDemo!2026`);
await mongoose.disconnect();
