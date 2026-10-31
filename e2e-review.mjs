import http from 'node:http';

const API_BASE = 'http://localhost:4000/api/v1';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, headers: res.headers, text, json };
}

async function run() {
  console.log('--- STARTING E2E INTEGRATION & EDGE CASE SUITE ---');

  // 1. Health check
  console.log('\n[1] Verifying Health Check...');
  const healthRes = await request('/health/ready');
  if (healthRes.status !== 200 || healthRes.json?.status !== 'ready') {
    throw new Error(`Health check failed: ${healthRes.status} ${healthRes.text}`);
  }
  console.log('✓ API health / ready OK');

  // 2. Catalog check
  console.log('\n[2] Verifying Product Catalog & Discovery...');
  const catalogRes = await request('/products?limit=12');
  if (catalogRes.status !== 200 || !catalogRes.json?.items?.length) {
    throw new Error(`Catalog fetch failed: ${catalogRes.status}`);
  }
  const products = catalogRes.json.items;
  console.log(`✓ Fetched ${products.length} products from catalog`);
  const inStock = products.filter(p => p.stock >= 2);
  const testProduct = inStock[0] || products[0];
  const testProduct2 = inStock[1] || products[1];
  console.log(`  Sample product: "${testProduct.name}" (ID: ${testProduct._id}, Price: ₹${testProduct.pricePaise / 100}, Stock: ${testProduct.stock})`);

  // 3. Customer Auth
  console.log('\n[3] Authenticating as Customer...');
  const loginRes = await request('/auth/login', {
    method: 'POST',
    body: { email: 'customer@fs01.local', password: 'CustomerDemo!2026' },
  });
  if (loginRes.status !== 200 || !loginRes.json?.accessToken) {
    throw new Error(`Login failed: ${loginRes.status} ${loginRes.text}`);
  }
  const customerToken = loginRes.json.accessToken;
  const customerHeaders = { Authorization: `Bearer ${customerToken}` };
  console.log('✓ Customer logged in successfully');

  // 4. Wishlist API (MongoDB synced)
  console.log('\n[4] Testing MongoDB-synced Wishlist...');
  // Toggle product into wishlist
  const toggleAdd = await request('/users/me/wishlist/toggle', {
    method: 'POST',
    headers: customerHeaders,
    body: { productId: testProduct._id },
  });
  if (toggleAdd.status !== 200) {
    throw new Error(`Wishlist toggle add failed: ${toggleAdd.status} ${toggleAdd.text}`);
  }
  console.log(`✓ Wishlist toggle add responded: added=${toggleAdd.json.added}`);

  const getWishlist = await request('/users/me/wishlist', {
    headers: customerHeaders,
  });
  if (getWishlist.status !== 200 || !getWishlist.json.productIds.includes(testProduct._id)) {
    throw new Error(`Wishlist GET did not return added product: ${getWishlist.text}`);
  }
  console.log(`✓ Wishlist GET confirmed product ${testProduct._id} is persisted in MongoDB`);

  // Toggle remove
  const toggleRemove = await request('/users/me/wishlist/toggle', {
    method: 'POST',
    headers: customerHeaders,
    body: { productId: testProduct._id },
  });
  if (toggleRemove.status !== 200 || toggleRemove.json.added !== false) {
    throw new Error(`Wishlist toggle remove failed: ${toggleRemove.status} ${toggleRemove.text}`);
  }
  console.log('✓ Wishlist toggle remove responded with added=false');

  // 5. Checkout & Order Item Image Verification
  console.log('\n[5] Testing Cart & Checkout with Product Images...');
  // Create or get customer address
  const addrRes = await request('/users/me/addresses', {
    method: 'POST',
    headers: customerHeaders,
    body: {
      label: 'Home',
      recipient: 'Yuvraj Negy',
      phone: '+919876543210',
      line1: 'Flat 402, High Garden Towers',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560001',
      country: 'India',
      isDefault: true,
    },
  });
  const addressId = addrRes.json?.address?._id;
  if (!addressId) {
    throw new Error(`Failed to create customer address: ${addrRes.text}`);
  }
  console.log(`✓ Customer shipping address ready (ID: ${addressId})`);

  // Update cart
  await request('/cart', {
    method: 'PUT',
    headers: customerHeaders,
    body: { items: [{ productId: testProduct._id, quantity: 1 }] },
  });

  // Create checkout order
  const checkoutRes = await request('/checkout', {
    method: 'POST',
    headers: { ...customerHeaders, 'Idempotency-Key': `idem-${Date.now()}-${Math.random()}` },
    body: {
      addressId,
      items: [{ productId: testProduct._id, quantity: 1 }],
    },
  });
  if (checkoutRes.status !== 201) {
    throw new Error(`Checkout failed: ${checkoutRes.status} ${checkoutRes.text}`);
  }
  const order = checkoutRes.json.order;
  console.log(`✓ Checkout created Order ID: ${order._id}`);
  
  // Verify order item has imageUrl
  const item0 = order.items[0];
  if (!item0.imageUrl) {
    throw new Error(`Order item is missing imageUrl! Got: ${JSON.stringify(item0)}`);
  }
  console.log(`✓ Verified order item contains real imageUrl: "${item0.imageUrl.slice(0, 50)}..."`);

  // Confirm mock payment
  const confirmPay = await request('/payments/mock/confirm', {
    method: 'POST',
    headers: customerHeaders,
    body: { orderId: order._id },
  });
  if (confirmPay.status !== 200) {
    throw new Error(`Mock payment confirm failed: ${confirmPay.status} ${confirmPay.text}`);
  }
  console.log('✓ Mock escrow payment confirmed, order status is CONFIRMED');

  // 6. Direct Invoice Download Authentication
  console.log('\n[6] Testing Direct Invoice Download with query token...');
  // Direct link without auth
  const unauthInvoice = await request(`/orders/${order._id}/invoice`);
  if (unauthInvoice.status !== 401) {
    throw new Error(`Invoice without auth should return 401, got ${unauthInvoice.status}`);
  }
  console.log('✓ Unauthenticated invoice request correctly rejected with 401');

  // Direct link with ?token=...
  const authInvoice = await request(`/orders/${order._id}/invoice?token=${encodeURIComponent(customerToken)}`);
  if (authInvoice.status !== 200) {
    throw new Error(`Invoice with ?token= failed with status ${authInvoice.status}`);
  }
  if (!authInvoice.text.toLowerCase().includes('tax invoice') || !authInvoice.text.includes(order.paymentReference)) {
    throw new Error('Invoice response does not contain Tax Invoice HTML or payment reference');
  }
  console.log('✓ Authenticated invoice download via query token succeeded with Tax Invoice HTML');

  // 7. Customer Order Cancellation
  console.log('\n[7] Testing Customer Order Cancellation...');
  const cancelRes = await request(`/orders/${order._id}/cancel`, {
    method: 'POST',
    headers: customerHeaders,
  });
  if (cancelRes.status !== 200 || cancelRes.json.status !== 'CANCELLED' || cancelRes.json.paymentStatus !== 'REFUNDED') {
    throw new Error(`Order cancellation failed: ${cancelRes.status} ${cancelRes.text}`);
  }
  console.log('✓ Customer order successfully cancelled (status: CANCELLED, paymentStatus: REFUNDED)');

  // Try cancelling again -> should be rejected (400)
  const reCancel = await request(`/orders/${order._id}/cancel`, {
    method: 'POST',
    headers: customerHeaders,
  });
  if (reCancel.status !== 400) {
    throw new Error(`Re-cancelling already cancelled order should return 400, got ${reCancel.status}`);
  }
  console.log('✓ Idempotency guard: Re-cancelling already cancelled order rejected with 400');

  // 8. Vendor Out-of-Stock Item Cancellation & Multi-package Status Recalculation
  console.log('\n[8] Testing Vendor Order Item Fulfillment & Out-of-Stock Cancellation...');
  // Vendor login
  const vendorLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'maker@fs01.local', password: 'MakerDemo!2026' },
  });
  if (vendorLogin.status !== 200) {
    throw new Error(`Vendor login failed: ${vendorLogin.status} ${vendorLogin.text}`);
  }
  const vendorToken = vendorLogin.json.accessToken;
  const vendorHeaders = { Authorization: `Bearer ${vendorToken}` };

  // Get a product owned by maker that is published and in stock
  const vProductsRes = await request('/vendor/products', { headers: vendorHeaders });
  const makerProduct = (vProductsRes.json?.items || []).find(p => p.status === 'PUBLISHED' && p.stock >= 2);
  if (!makerProduct) {
    throw new Error(`No published maker product with stock >= 2 found: ${JSON.stringify(vProductsRes.json)}`);
  }
  console.log(`✓ Selected maker product "${makerProduct.name}" (Stock: ${makerProduct.stock})`);

  // Place another customer order
  await request('/cart', {
    method: 'PUT',
    headers: customerHeaders,
    body: { items: [{ productId: makerProduct._id, quantity: 2 }] },
  });
  const order2Res = await request('/checkout', {
    method: 'POST',
    headers: { ...customerHeaders, 'Idempotency-Key': `idem-${Date.now()}-${Math.random()}` },
    body: {
      addressId,
      items: [{ productId: makerProduct._id, quantity: 2 }],
    },
  });
  const order2 = order2Res.json?.order;
  if (!order2) {
    throw new Error(`Order2 checkout failed: ${order2Res.status} ${order2Res.text}`);
  }
  await request('/payments/mock/confirm', {
    method: 'POST',
    headers: customerHeaders,
    body: { orderId: order2._id },
  });
  const itemToCancel = order2.items[0];

  // Vendor marks item CANCELLED
  const vendorCancelRes = await request(`/vendor/orders/${order2._id}/items/${itemToCancel._id}/fulfillment`, {
    method: 'PATCH',
    headers: vendorHeaders,
    body: { status: 'CANCELLED' },
  });
  if (vendorCancelRes.status !== 200) {
    throw new Error(`Vendor cancel failed: ${vendorCancelRes.status} ${vendorCancelRes.text}`);
  }
  if (vendorCancelRes.json.orderStatus !== 'CANCELLED') {
    throw new Error(`Order status expected CANCELLED since all items cancelled, got: ${vendorCancelRes.json.orderStatus}`);
  }
  console.log('✓ Vendor item cancellation succeeded and properly set order status to CANCELLED');

  // 9. Admin Coupon Creation
  console.log('\n[9] Testing Admin Coupon Creation...');
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@fs01.local', password: 'AdminDemo!2026' },
  });
  if (adminLogin.status !== 200) {
    throw new Error(`Admin login failed: ${adminLogin.status}`);
  }
  const adminToken = adminLogin.json.accessToken;
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };

  const couponCode = `FESTIVE${Date.now().toString().slice(-4)}`;
  const createCouponRes = await request('/admin/coupons', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      code: couponCode,
      description: 'Festive Season 15% Marketplace Discount',
      discountType: 'PERCENTAGE',
      discountValue: 15,
      minOrderPaise: 50000,
      maxDiscountPaise: 100000,
      isActive: true,
    },
  });
  if (createCouponRes.status !== 201) {
    throw new Error(`Admin create coupon failed: ${createCouponRes.status} ${createCouponRes.text}`);
  }
  console.log(`✓ Admin successfully created coupon: ${couponCode} with 15% discount`);

  // 10. Concurrent Inventory Depletion Race Test
  console.log('\n[10] Testing Concurrent Checkout Race Condition on Limited Stock...');
  // Find a product with available stock
  const freshList = (await request('/products?limit=24')).json?.items || [];
  const limitedProduct = freshList.find(p => p.stock > 0);
  if (!limitedProduct) {
    throw new Error('No in-stock products found for race test');
  }
  console.log(`  Target product: "${limitedProduct.name}" (ID: ${limitedProduct._id}, Current stock: ${limitedProduct.stock})`);

  // Deplete stock down to a small amount (<= 5) so both race requests can ask for the exact remaining stock
  let currentStock = limitedProduct.stock;
  while (currentStock > 6) {
    const chunk = Math.min(currentStock - 4, 15);
    const drainRes = await request('/checkout', {
      method: 'POST',
      headers: { ...customerHeaders, 'Idempotency-Key': `drain-${Date.now()}-${Math.random()}` },
      body: { addressId, items: [{ productId: limitedProduct._id, quantity: chunk }] },
    });
    if (drainRes.status !== 201) break;
    currentStock -= chunk;
  }
  console.log(`  Stock tuned for race condition: ${currentStock} units remaining`);

  // Fire two simultaneous checkouts requesting the entire available stock (between 1 and 6 units)
  const qtyToRequest = Math.max(1, Math.min(currentStock, 6));
  const [race1, race2] = await Promise.all([
    request('/checkout', {
      method: 'POST',
      headers: { ...customerHeaders, 'Idempotency-Key': `race-1-${Date.now()}` },
      body: { addressId, items: [{ productId: limitedProduct._id, quantity: qtyToRequest }] },
    }),
    request('/checkout', {
      method: 'POST',
      headers: { ...customerHeaders, 'Idempotency-Key': `race-2-${Date.now()}` },
      body: { addressId, items: [{ productId: limitedProduct._id, quantity: qtyToRequest }] },
    }),
  ]);

  const statuses = [race1.status, race2.status].sort();
  console.log(`  Concurrent checkout response statuses: ${race1.status} and ${race2.status}`);
  // Exactly one should succeed (201) and the second must be rejected with 409 INSUFFICIENT_STOCK
  if (!statuses.includes(201) || !statuses.includes(409)) {
    throw new Error(`Expected one 201 and one 409, but received: ${statuses.join(', ')}`);
  }
  console.log('✓ Concurrency race test PASSED: Exactly one order reserved inventory; competitor received 409 INSUFFICIENT_STOCK');

  console.log('\n=============================================');
  console.log('ALL INTEGRATION & EDGE CASE TESTS PASSED SUCCESSFULLY!');
  console.log('=============================================\n');
}

run().catch(err => {
  console.error('\n❌ E2E TEST FAILED:', err);
  process.exit(1);
});
