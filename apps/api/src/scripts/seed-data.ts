import bcrypt from 'bcryptjs';
import { User, VendorProfile, Product, Review, Coupon } from '../models.js';

export async function seedCatalog(): Promise<void> {
  const productCount = await Product.countDocuments();
  if (productCount > 0) {
    console.log(`[Seed] Catalog already has ${productCount} products. Skipping duplicate seed.`);
    return;
  }

  console.log('[Seed] Seeding database with realistic multi-vendor marketplace data...');

  // 1. Password hashes
  const vendorPass = await bcrypt.hash('MakerDemo!2026', 10);
  const nomadPass = await bcrypt.hash('NomadDemo!2026', 10);
  const auraPass = await bcrypt.hash('AuraDemo!2026', 10);
  const customerPass = await bcrypt.hash('CustomerDemo!2026', 10);
  const adminPass = await bcrypt.hash('AdminDemo!2026', 10);

  // 2. Users & Vendor Profiles
  const vendor1 = await User.findOneAndUpdate(
    { email: 'maker@fs01.local' },
    { $setOnInsert: { name: 'Julian Vance', email: 'maker@fs01.local', passwordHash: vendorPass, role: 'VENDOR', status: 'ACTIVE' } },
    { upsert: true, new: true }
  );
  await VendorProfile.findOneAndUpdate(
    { userId: vendor1._id },
    { $setOnInsert: { userId: vendor1._id, shopName: 'Studio North', slug: 'studio-north', description: 'Architectural ceramics, handcrafted lighting, and mindful living objects.', status: 'APPROVED', razorpayLinkedAccountId: 'acc_demo_studio_north' } },
    { upsert: true }
  );

  const vendor2 = await User.findOneAndUpdate(
    { email: 'nomad@fs01.local' },
    { $setOnInsert: { name: 'Elena Rostova', email: 'nomad@fs01.local', passwordHash: nomadPass, role: 'VENDOR', status: 'ACTIVE' } },
    { upsert: true, new: true }
  );
  await VendorProfile.findOneAndUpdate(
    { userId: vendor2._id },
    { $setOnInsert: { userId: vendor2._id, shopName: 'Nomad Workshop', slug: 'nomad-workshop', description: 'Heavyweight waxed canvas, vegetable-tanned leather, and durable expedition carry.', status: 'APPROVED', razorpayLinkedAccountId: 'acc_demo_nomad' } },
    { upsert: true }
  );

  const vendor3 = await User.findOneAndUpdate(
    { email: 'aura@fs01.local' },
    { $setOnInsert: { name: 'Devika Sharma', email: 'aura@fs01.local', passwordHash: auraPass, role: 'VENDOR', status: 'ACTIVE' } },
    { upsert: true, new: true }
  );
  await VendorProfile.findOneAndUpdate(
    { userId: vendor3._id },
    { $setOnInsert: { userId: vendor3._id, shopName: 'Aura Botanicals', slug: 'aura-botanicals', description: 'Hand-poured soy candles, pure botanical essential oils, and organic herbal teas.', status: 'APPROVED', razorpayLinkedAccountId: 'acc_demo_aura' } },
    { upsert: true }
  );

  const pendingVendor = await User.findOneAndUpdate(
    { email: 'pending.maker@fs01.local' },
    { $setOnInsert: { name: 'Kailash Prajapat', email: 'pending.maker@fs01.local', passwordHash: vendorPass, role: 'CUSTOMER', status: 'ACTIVE' } },
    { upsert: true, new: true }
  );
  await VendorProfile.findOneAndUpdate(
    { userId: pendingVendor._id },
    { $setOnInsert: { userId: pendingVendor._id, shopName: 'Jaipur Blue Pottery', slug: 'jaipur-blue-pottery', description: 'Heritage quartz-based cobalt glazed decorative pottery and architectural tile-work from Kot Jewar.', status: 'PENDING' } },
    { upsert: true }
  );

  const customer = await User.findOneAndUpdate(
    { email: 'customer@fs01.local' },
    { $setOnInsert: { name: 'Yuvraj Negy', email: 'customer@fs01.local', passwordHash: customerPass, role: 'CUSTOMER', status: 'ACTIVE' } },
    { upsert: true, new: true }
  );

  await User.findOneAndUpdate(
    { email: 'admin@fs01.local' },
    { $setOnInsert: { name: 'Marketplace Admin', email: 'admin@fs01.local', passwordHash: adminPass, role: 'ADMIN', status: 'ACTIVE' } },
    { upsert: true }
  );

  // 3. Products
  const catalog = [
    {
      name: 'Sculptural Ceramic Pour-Over Dripper',
      slug: 'ceramic-pour-over-dripper',
      category: 'Home & Living',
      vendorId: vendor1._id,
      pricePaise: 289900, // ₹2,899
      stock: 18,
      description: 'Wheel-thrown stoneware dripper designed for optimal water drawdown. Features ribbed interior spiral flutes to guarantee consistent extraction and clean cup clarity.',
      imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80',
      ratingAverage: 4.8,
      ratingCount: 14,
    },
    {
      name: 'Minimalist Matte Terracotta Vase',
      slug: 'minimalist-terracotta-vase',
      category: 'Home & Living',
      vendorId: vendor1._id,
      pricePaise: 349900, // ₹3,499
      stock: 9,
      description: 'Hand-finished raw terracotta with an unglazed mineral exterior and water-sealed interior. An earthy, grounding silhouette suited for dried florals or solitary stems.',
      imageUrl: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=80',
      ratingAverage: 4.9,
      ratingCount: 22,
    },
    {
      name: 'Brushed Brass Table Accent Lamp',
      slug: 'brushed-brass-lamp',
      category: 'Home & Living',
      vendorId: vendor1._id,
      pricePaise: 649900, // ₹6,499
      stock: 6,
      description: 'Warm ambient illumination cast from solid spun brass. Includes an in-line rotary dimmer and hand-woven braided linen cable for bedside or credenza placement.',
      imageUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=80',
      ratingAverage: 4.7,
      ratingCount: 8,
    },
    {
      name: 'Cast Iron Teapot with Trivet',
      slug: 'cast-iron-teapot',
      category: 'Home & Living',
      vendorId: vendor1._id,
      pricePaise: 429900, // ₹4,299
      stock: 14,
      description: 'Traditional Japanese-style tetsubin cast iron teapot with porcelain enamel lining. Retains temperature evenly for prolonged steeping rituals.',
      imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=800&q=80',
      ratingAverage: 5.0,
      ratingCount: 19,
    },
    {
      name: 'Heavyweight Waxed Canvas Field Tote',
      slug: 'waxed-canvas-field-tote',
      category: 'Accessories & Wear',
      vendorId: vendor2._id,
      pricePaise: 389900, // ₹3,899
      stock: 25,
      description: 'Crafted from 18oz paraffin-waxed duck canvas and 8oz bridle leather handles with solid copper hand-peened rivets. Weather-resistant and built to age with character.',
      imageUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80',
      ratingAverage: 4.9,
      ratingCount: 31,
    },
    {
      name: 'Vegetable-Tanned Bifold Card Wallet',
      slug: 'veg-tan-card-wallet',
      category: 'Accessories & Wear',
      vendorId: vendor2._id,
      pricePaise: 189900, // ₹1,899
      stock: 40,
      description: 'Full-grain Italian Buttero leather cut by hand and saddle-stitched with waxed linen thread. Develops an extraordinary honeyed patina with everyday carry.',
      imageUrl: 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=800&q=80',
      ratingAverage: 4.8,
      ratingCount: 27,
    },
    {
      name: 'Forged Titanium Carabiner Keychain',
      slug: 'titanium-carabiner-keychain',
      category: 'Accessories & Wear',
      vendorId: vendor2._id,
      pricePaise: 129900, // ₹1,299
      stock: 50,
      description: 'Grade 5 aerospace titanium skeletonized for featherweight strength. Integrated bottle lifter and dual split-ring retention gate.',
      imageUrl: 'https://images.unsplash.com/photo-1606830733744-0ad778449672?auto=format&fit=crop&w=800&q=80',
      ratingAverage: 4.6,
      ratingCount: 15,
    },
    {
      name: 'Heritage Canvas Roll-Top Rucksack',
      slug: 'canvas-roll-top-rucksack',
      category: 'Accessories & Wear',
      vendorId: vendor2._id,
      pricePaise: 799900, // ₹7,999
      stock: 11,
      description: 'Expandable 24-liter commuter backpack with padded 16-inch laptop compartment, waterproof YKK Aquaguard side access zipper, and storm-proof roll-top buckle closure.',
      imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80',
      ratingAverage: 4.9,
      ratingCount: 18,
    },
    {
      name: 'Hand-Poured Sandalwood & Amber Soy Candle',
      slug: 'sandalwood-amber-soy-candle',
      category: 'Apothecary & Wellness',
      vendorId: vendor3._id,
      pricePaise: 149900, // ₹1,499
      stock: 35,
      description: 'Pure Midwest soybean wax infused with therapeutic-grade Mysore sandalwood, golden amber resin, and vetiver. 55-hour clean burn with unbleached cotton wick.',
      imageUrl: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=800&q=80',
      ratingAverage: 4.9,
      ratingCount: 42,
    },
    {
      name: 'Cold-Pressed Himalayan Hemp Seed Facial Serum',
      slug: 'hemp-seed-facial-serum',
      category: 'Apothecary & Wellness',
      vendorId: vendor3._id,
      pricePaise: 219900, // ₹2,199
      stock: 22,
      description: 'Wildcrafted hemp seed oil packed with omega 3-6 fatty acids, blue tansy, and squalane. Calms redness, deeply hydrates without clogging pores.',
      imageUrl: 'https://images.unsplash.com/photo-1608248597359-52e693141f64?auto=format&fit=crop&w=800&q=80',
      ratingAverage: 4.7,
      ratingCount: 16,
    },
    {
      name: 'Organic Earl Grey Lavender Botanical Tea',
      slug: 'earl-grey-lavender-tea',
      category: 'Apothecary & Wellness',
      vendorId: vendor3._id,
      pricePaise: 99900, // ₹999
      stock: 60,
      description: 'Whole-leaf Nilgiri black tea scented with cold-pressed Calabrian bergamot oil and French lavender buds. Presented in an airtight reusable metal caddy.',
      imageUrl: 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&w=800&q=80',
      ratingAverage: 4.8,
      ratingCount: 38,
    },
    {
      name: 'Clothbound Layflat Dot-Grid Journal',
      slug: 'layflat-dot-grid-journal',
      category: 'Stationery & Paper',
      vendorId: vendor1._id,
      pricePaise: 119900, // ₹1,199
      stock: 45,
      description: '160gsm bleed-proof bamboo paper suited for fountain pens, markers, and watercolor washes. Opens completely 180 degrees flat with dual ribbon place-markers.',
      imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
      ratingAverage: 5.0,
      ratingCount: 29,
    },
  ];

  for (const item of catalog) {
    const createdProduct = await Product.create({
      ...item,
      status: 'PUBLISHED',
    });

    // Seed sample reviews for social proof
    await Review.create({
      productId: createdProduct._id,
      customerId: customer._id,
      customerName: 'Yuvraj N.',
      rating: 5,
      headline: 'Exceeded every expectation',
      comment: 'The tactile craftsmanship is evident from the moment you unbox it. Solid weight, premium materials, and fast shipping from the maker.',
      verifiedPurchase: true,
    });
  }

  // 4. Seed Coupons
  await Coupon.create([
    {
      code: 'WELCOME10',
      description: '10% off your entire first artisan order',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      minOrderPaise: 50000, // ₹500 min
      maxDiscountPaise: 50000, // ₹500 cap
      isActive: true,
    },
    {
      code: 'FLAT500',
      description: 'Flat ₹500 discount on orders above ₹2,000',
      discountType: 'FLAT',
      discountValue: 50000, // ₹500 off
      minOrderPaise: 200000, // ₹2,000 min
      maxDiscountPaise: 50000,
      isActive: true,
    },
    {
      code: 'FESTIVE25',
      description: '25% festive curation celebration discount',
      discountType: 'PERCENTAGE',
      discountValue: 25,
      minOrderPaise: 150000, // ₹1,500 min
      maxDiscountPaise: 100000, // ₹1,000 cap
      isActive: true,
    },
  ]);

  console.log(`[Seed] Successfully seeded ${catalog.length} products, 3 vendors, 1 customer, 1 admin, reviews, and 3 promotional coupons!`);
}
