import React, { useState } from 'react';
import {
  ArrowRight,
  CreditCard,
  Lock,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Store,
  Tag,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import {
  useAddAddressMutation,
  useAddressesQuery,
  useApplyCouponMutation,
  useCartQuery,
  useCheckoutMutation,
  useConfirmMockPaymentMutation,
  useMeQuery,
  useUpdateCartMutation,
} from '../api';
import { formatPrice } from '../utils';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth: () => void;
  onOrderSuccess: (orderId: string) => void;
  deliveryPincode?: string;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  onOpenAuth,
  onOrderSuccess,
  deliveryPincode = '110001',
}) => {
  const { data: identity } = useMeQuery();
  const isCustomer = identity?.user?.role === 'CUSTOMER';
  const { data: cartData } = useCartQuery(undefined, { skip: !isCustomer });
  const { data: addressData } = useAddressesQuery(undefined, { skip: !isCustomer || !isOpen });

  const [updateCart] = useUpdateCartMutation();
  const [addAddress] = useAddAddressMutation();
  const [checkout] = useCheckoutMutation();
  const [confirmPayment] = useConfirmMockPaymentMutation();
  const [applyCoupon] = useApplyCouponMutation();

  // Checkout modal flow
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<1 | 2 | 3>(1);
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'cod'>('upi');
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Coupon state
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; discountPaise: number } | null>(null);
  const [couponError, setCouponError] = useState('');
  const [notice, setNotice] = useState('');
  const [showAddressForm, setShowAddressForm] = useState(false);

  if (!isOpen) return null;

  if (!isCustomer) {
    return (
      <div className="amz-modal-backdrop" onClick={onClose}>
        <div className="amz-checkout-modal" style={{ maxWidth: 440, padding: 32 }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>Sign in to continue</h2>
            <button onClick={onClose}><X size={20} /></button>
          </div>
          <p style={{ color: '#565959', fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
            Please sign in as a customer to manage your Cart, redeem coupons, and place multi-vendor orders with fast delivery.
          </p>
          <button
            className="amz-btn-cart"
            onClick={() => {
              onClose();
              onOpenAuth();
            }}
          >
            Sign in to your account
          </button>
        </div>
      </div>
    );
  }

  const items = cartData?.items ?? [];
  const subtotalPaise = items.reduce((sum, item) => sum + item.product.pricePaise * item.quantity, 0);
  const discountPaise = appliedDiscount ? appliedDiscount.discountPaise : 0;
  const shippingPaise = subtotalPaise > 50000 || subtotalPaise === 0 ? 0 : 9900;
  const finalTotalPaise = Math.max(0, subtotalPaise - discountPaise + shippingPaise);

  const addresses = addressData?.items ?? [];
  const effectiveAddressId = selectedAddressId || (addresses.find(a => a.isDefault)?._id ?? addresses[0]?._id ?? '');
  const selectedAddress = addresses.find(a => a._id === effectiveAddressId);

  // Group items by vendor for Amazon-style multi-vendor packaging
  const itemsByVendor = items.reduce((acc, item) => {
    const vKey = item.product.vendorId || 'studio_artisan';
    if (!acc[vKey]) acc[vKey] = [];
    acc[vKey].push(item);
    return acc;
  }, {} as Record<string, typeof items>);

  const handleQuantityChange = async (productId: string, newQty: number) => {
    let nextItems = items.map(i => ({ productId: i.product._id, quantity: i.quantity }));
    if (newQty <= 0) {
      nextItems = nextItems.filter(i => i.productId !== productId);
    } else {
      const match = nextItems.find(i => i.productId === productId);
      if (match) match.quantity = Math.min(20, newQty);
    }
    await updateCart({ items: nextItems });
    if (appliedDiscount) {
      handleApplyCoupon(appliedDiscount.code);
    }
  };

  const handleApplyCoupon = async (codeToApply: string) => {
    const code = codeToApply.trim().toUpperCase();
    if (!code) return;
    setCouponError('');
    try {
      const res = await applyCoupon({ code, subtotalPaise }).unwrap();
      if (res.valid) {
        setAppliedDiscount({ code: res.coupon.code, discountPaise: res.discountPaise });
        setNotice(`Coupon ${res.coupon.code} applied! Saved ${formatPrice(res.discountPaise)}.`);
      }
    } catch (err: any) {
      setAppliedDiscount(null);
      setCouponError(err?.data?.error?.message || 'Invalid or ineligible coupon code.');
    }
  };

  const handleSaveAddress = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      const created = await addAddress({
        label: String(form.get('label') || 'Home'),
        recipient: String(form.get('recipient')),
        phone: String(form.get('phone')),
        line1: String(form.get('line1')),
        line2: String(form.get('line2') || ''),
        city: String(form.get('city')),
        state: String(form.get('state')),
        postalCode: String(form.get('postalCode')),
        country: 'India',
        isDefault: true,
      }).unwrap();
      setSelectedAddressId(created.address._id);
      setShowAddressForm(false);
      setNotice('Address saved successfully.');
    } catch {
      setNotice('Could not save address. Please check input fields.');
    }
  };

  // Final Order Execution (Checkout + Instant Mock Payment Confirmation)
  const handleCompleteOrder = async () => {
    if (!effectiveAddressId || !items.length) return;
    setIsProcessing(true);
    setNotice('');
    try {
      // 1. Create order via checkout
      const result = await checkout({
        addressId: effectiveAddressId,
        items: items.map(item => ({ productId: item.product._id, quantity: item.quantity })),
        idempotencyKey: crypto.randomUUID(),
        couponCode: appliedDiscount?.code,
      }).unwrap();

      const orderId = result.order._id;

      // 2. In mock mode, confirm payment so order moves to PLACED / PAID immediately
      await confirmPayment({ orderId }).unwrap();

      // 3. Clear local cart
      await updateCart({ items: [] });

      setIsProcessing(false);
      setIsCheckoutOpen(false);
      onClose();
      onOrderSuccess(orderId);
    } catch (err: any) {
      setIsProcessing(false);
      setNotice(err?.data?.error?.message || 'Checkout failed. Please verify product stock.');
    }
  };

  return (
    <>
      {/* Background Dim Backdrop */}
      <div className="amz-modal-backdrop" onClick={onClose} style={{ zIndex: 400 }} />

      {/* Cart Drawer */}
      <aside className="amz-cart-drawer">
        {/* Drawer Header */}
        <div className="amz-cart-header">
          <h2>
            <ShoppingBag size={22} color="#aa775e" /> Shopping Bag ({items.length} items)
          </h2>
          <button onClick={onClose} style={{ color: '#ffffff' }} aria-label="Close Bag">
            <X size={22} />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="amz-cart-body">
          {/* Free Express Delivery Meter */}
          <div className="amz-free-delivery-meter">
            <Truck size={18} />
            {subtotalPaise >= 50000 || subtotalPaise === 0 ? (
              <span>🎉 <strong>You have unlocked FREE Delivery</strong> on this order!</span>
            ) : (
              <span>
                Add <strong>{formatPrice(50000 - subtotalPaise)}</strong> more to get <strong>FREE Express Delivery</strong>
              </span>
            )}
          </div>

          {notice && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '8px 12px', borderRadius: 4, fontSize: 12, marginBottom: 14 }}>
              {notice}
            </div>
          )}

          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#72766d' }}>
              <ShoppingCart size={48} color="#cccccc" style={{ margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: 18, color: '#242b23', marginBottom: 8 }}>Your Bag is empty</h3>
              <p style={{ fontSize: 13, marginBottom: 20 }}>Explore handcrafted artisan treasures and support independent makers.</p>
              <button className="amz-btn-cart" onClick={onClose} style={{ width: 'auto', padding: '8px 24px', margin: '0 auto' }}>
                Continue Shopping
              </button>
            </div>
          ) : (
            <>
              {/* Grouped Multi-Vendor Packages */}
              {Object.entries(itemsByVendor).map(([vendorId, vendorItems], vIdx) => (
                <div className="amz-cart-vendor-box" key={vendorId}>
                  <div className="amz-cart-vendor-head">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Store size={14} color="#455d46" />
                      <span>Package {vIdx + 1}: Dispatched by Artisan Studio</span>
                    </div>
                    <span>★ Artisan Express</span>
                  </div>

                  {vendorItems.map(item => (
                    <div className="amz-cart-item-row" key={item.product._id}>
                      <img src={item.product.imageUrl} alt={item.product.name} />
                      <div>
                        <div className="amz-cart-item-title">{item.product.name}</div>
                        <div style={{ fontSize: 11, color: '#007600', fontWeight: 600, marginTop: 2 }}>In Stock</div>
                        <div style={{ fontSize: 11, color: '#565959' }}>Eligible for FREE Shipping</div>

                        {/* Quantity Controls */}
                        <div className="amz-cart-qty-ctrl">
                          <button
                            onClick={() => handleQuantityChange(item.product._id, item.quantity - 1)}
                            style={{ padding: '2px 4px' }}
                            aria-label="Decrease quantity"
                          >
                            <Minus size={12} />
                          </button>
                          <span style={{ fontSize: 12, fontWeight: 700, padding: '0 6px' }}>{item.quantity}</span>
                          <button
                            onClick={() => handleQuantityChange(item.product._id, item.quantity + 1)}
                            style={{ padding: '2px 4px' }}
                            aria-label="Increase quantity"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div className="amz-cart-item-price">
                          {formatPrice(item.product.pricePaise * item.quantity)}
                        </div>
                        <button
                          onClick={() => handleQuantityChange(item.product._id, 0)}
                          style={{ color: '#455d46', fontSize: 11, marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 3 }}
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              {/* Available Promotional Coupons */}
              <div className="amz-coupons-box">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#0f1111' }}>
                  <Tag size={15} color="#b12704" /> Available Marketplace Coupons
                </div>
                {couponError && (
                  <div style={{ color: '#b12704', fontSize: 12, marginTop: 4 }}>{couponError}</div>
                )}
                <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                  {[
                    { code: 'WELCOME10', desc: '10% off entire artisan purchase', min: '₹500' },
                    { code: 'FLAT500', desc: 'Flat ₹500 off on orders above ₹2,000', min: '₹2,000' },
                    { code: 'FESTIVE25', desc: '25% festive celebration discount', min: '₹1,500' },
                  ].map(cp => (
                    <div className="amz-coupon-pill" key={cp.code}>
                      <div>
                        <strong>{cp.code}</strong> — {cp.desc}
                        <div style={{ fontSize: 10, color: '#767676' }}>Min. order: {cp.min}</div>
                      </div>
                      <button
                        onClick={() => handleApplyCoupon(cp.code)}
                        style={{
                          background: appliedDiscount?.code === cp.code ? '#007600' : '#f0f2f2',
                          color: appliedDiscount?.code === cp.code ? '#fff' : '#0f1111',
                          border: '1px solid #d5d9d9',
                          borderRadius: 3,
                          padding: '3px 8px',
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {appliedDiscount?.code === cp.code ? 'Applied ✓' : 'Apply'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Drawer Footer Checkout Button */}
        {items.length > 0 && (
          <div className="amz-cart-footer">
            <div className="amz-cart-summary-line">
              <span>Items Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} items):</span>
              <b>{formatPrice(subtotalPaise)}</b>
            </div>
            {discountPaise > 0 && (
              <div className="amz-cart-summary-line" style={{ color: '#007600' }}>
                <span>Coupon Savings ({appliedDiscount?.code}):</span>
                <b>-{formatPrice(discountPaise)}</b>
              </div>
            )}
            <div className="amz-cart-summary-line">
              <span>Estimated Shipping:</span>
              <span>{shippingPaise === 0 ? <strong style={{ color: '#007600' }}>FREE</strong> : formatPrice(shippingPaise)}</span>
            </div>
            <div className="amz-cart-total-line">
              <span>Order Total:</span>
              <span style={{ color: '#b12704', fontSize: 18 }}>{formatPrice(finalTotalPaise)}</span>
            </div>

            <button
              className="amz-btn-buy"
              onClick={() => setIsCheckoutOpen(true)}
              style={{ fontSize: 14, padding: '10px 16px' }}
            >
              Proceed to Buy ({items.length} items) <ArrowRight size={16} />
            </button>
            <div style={{ textAlign: 'center', fontSize: 11, color: '#565959', marginTop: 8 }}>
              <Lock size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              100% Secure Multi-Vendor Escrow Checkout
            </div>
          </div>
        )}
      </aside>

      {/* =========================================================
         3-STEP CHECKOUT MODAL
         ========================================================= */}
      {isCheckoutOpen && (
        <div className="amz-modal-backdrop" onClick={() => !isProcessing && setIsCheckoutOpen(false)} style={{ zIndex: 600 }}>
          <div className="amz-checkout-modal" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ background: '#344534', color: '#fff', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={20} color="#aa775e" />
                <span style={{ fontSize: 16, fontWeight: 700 }}>Common Goods Secure Checkout</span>
              </div>
              {!isProcessing && (
                <button onClick={() => setIsCheckoutOpen(false)} style={{ color: '#fff' }}><X size={20} /></button>
              )}
            </div>

            {/* Steps Progress Tabs */}
            <div className="amz-checkout-steps-bar">
              <div className={`amz-checkout-step-tab ${checkoutStep === 1 ? 'active' : ''}`}>
                1. Delivery Address
              </div>
              <div className={`amz-checkout-step-tab ${checkoutStep === 2 ? 'active' : ''}`}>
                2. Payment Method
              </div>
              <div className={`amz-checkout-step-tab ${checkoutStep === 3 ? 'active' : ''}`}>
                3. Review & Place Order
              </div>
            </div>

            <div style={{ padding: 24, maxHeight: '70vh', overflowY: 'auto' }}>
              {/* STEP 1: DELIVERY ADDRESS */}
              {checkoutStep === 1 && (
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Select a delivery address</h3>

                  {addresses.length > 0 && !showAddressForm && (
                    <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
                      {addresses.map(addr => (
                        <label
                          key={addr._id}
                          style={{
                            border: `2px solid ${effectiveAddressId === addr._id ? '#e77600' : '#d5d9d9'}`,
                            background: effectiveAddressId === addr._id ? '#fcfbf7' : '#ffffff',
                            borderRadius: 6,
                            padding: '12px 16px',
                            display: 'flex',
                            gap: 12,
                            alignItems: 'flex-start',
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="radio"
                            name="delivery_address"
                            checked={effectiveAddressId === addr._id}
                            onChange={() => setSelectedAddressId(addr._id)}
                            style={{ marginTop: 3 }}
                          />
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f1111' }}>
                              {addr.recipient} <span style={{ fontSize: 12, fontWeight: 400, color: '#565959' }}>({addr.label})</span>
                            </div>
                            <div style={{ fontSize: 13, color: '#374151', margin: '4px 0' }}>
                              {addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}, {addr.city}, {addr.state} - <strong>{addr.postalCode}</strong>
                            </div>
                            <div style={{ fontSize: 12, color: '#565959' }}>Phone: {addr.phone}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}

                  {!showAddressForm && (
                    <button
                      onClick={() => setShowAddressForm(true)}
                      style={{ fontSize: 13, color: '#455d46', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 20 }}
                    >
                      <Plus size={15} /> Add a new address
                    </button>
                  )}

                  {showAddressForm && (
                    <form onSubmit={handleSaveAddress} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: 18, marginBottom: 20 }}>
                      <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Add a new delivery address</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                        <input name="recipient" placeholder="Full Name" required style={{ padding: 8, border: '1px solid #d5d9d9', borderRadius: 4 }} />
                        <input name="phone" placeholder="Mobile Number (+91...)" required style={{ padding: 8, border: '1px solid #d5d9d9', borderRadius: 4 }} />
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <input name="line1" placeholder="Flat, House no., Building, Street" required style={{ width: '100%', padding: 8, border: '1px solid #d5d9d9', borderRadius: 4 }} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
                        <input name="city" placeholder="City" defaultValue="New Delhi" required style={{ padding: 8, border: '1px solid #d5d9d9', borderRadius: 4 }} />
                        <input name="state" placeholder="State" defaultValue="Delhi" required style={{ padding: 8, border: '1px solid #d5d9d9', borderRadius: 4 }} />
                        <input name="postalCode" placeholder="PIN Code" defaultValue={deliveryPincode} required style={{ padding: 8, border: '1px solid #d5d9d9', borderRadius: 4 }} />
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button type="submit" className="amz-btn-cart" style={{ width: 'auto', padding: '6px 18px' }}>
                          Save & Use this Address
                        </button>
                        <button type="button" onClick={() => setShowAddressForm(false)} style={{ padding: '6px 14px', border: '1px solid #d5d9d9', borderRadius: 4 }}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                    <button
                      className="amz-btn-buy"
                      style={{ width: 'auto', padding: '10px 24px' }}
                      disabled={!effectiveAddressId}
                      onClick={() => setCheckoutStep(2)}
                    >
                      Use this address & Continue <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: PAYMENT METHOD */}
              {checkoutStep === 2 && (
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Select a payment method</h3>

                  <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
                    <label
                      style={{
                        border: `2px solid ${paymentMethod === 'upi' ? '#e77600' : '#d5d9d9'}`,
                        background: paymentMethod === 'upi' ? '#fcfbf7' : '#ffffff',
                        borderRadius: 6,
                        padding: 16,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="pay_method"
                        checked={paymentMethod === 'upi'}
                        onChange={() => setPaymentMethod('upi')}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f1111' }}>
                          ⚡ Instant UPI / NetBanking Simulator (Fast Evaluation)
                        </div>
                        <div style={{ fontSize: 12, color: '#565959', marginTop: 2 }}>
                          Instant automated verification via Mock Razorpay Route webhook. Order transitions directly to PAID!
                        </div>
                      </div>
                      <span style={{ fontSize: 11, background: '#e6f4ea', color: '#137333', padding: '2px 8px', borderRadius: 3, fontWeight: 700 }}>
                        RECOMMENDED
                      </span>
                    </label>

                    <label
                      style={{
                        border: `2px solid ${paymentMethod === 'card' ? '#e77600' : '#d5d9d9'}`,
                        background: paymentMethod === 'card' ? '#fcfbf7' : '#ffffff',
                        borderRadius: 6,
                        padding: 16,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="pay_method"
                        checked={paymentMethod === 'card'}
                        onChange={() => setPaymentMethod('card')}
                      />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f1111', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <CreditCard size={16} /> Credit or Debit Card
                        </div>
                        <div style={{ fontSize: 12, color: '#565959', marginTop: 2 }}>
                          Visa, MasterCard, RuPay, American Express (Processed via secure tokenization)
                        </div>
                      </div>
                    </label>

                    <label
                      style={{
                        border: `2px solid ${paymentMethod === 'cod' ? '#e77600' : '#d5d9d9'}`,
                        background: paymentMethod === 'cod' ? '#fcfbf7' : '#ffffff',
                        borderRadius: 6,
                        padding: 16,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="pay_method"
                        checked={paymentMethod === 'cod'}
                        onChange={() => setPaymentMethod('cod')}
                      />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f1111' }}>
                          Cash on Delivery (COD) / Pay on Delivery
                        </div>
                        <div style={{ fontSize: 12, color: '#565959', marginTop: 2 }}>
                          Pay with cash or UPI at your doorstep upon delivery
                        </div>
                      </div>
                    </label>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      onClick={() => setCheckoutStep(1)}
                      style={{ padding: '8px 16px', border: '1px solid #d5d9d9', borderRadius: 4 }}
                    >
                      Back to Address
                    </button>
                    <button
                      className="amz-btn-buy"
                      style={{ width: 'auto', padding: '10px 24px' }}
                      onClick={() => setCheckoutStep(3)}
                    >
                      Continue to Review <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: REVIEW & MULTI-VENDOR SPLIT BREAKDOWN */}
              {checkoutStep === 3 && (
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Review your order & split breakdown</h3>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18, background: '#f8f9fa', padding: 14, borderRadius: 6 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#565959', textTransform: 'uppercase' }}>Delivery Address</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0f1111', marginTop: 3 }}>{selectedAddress?.recipient}</div>
                      <div style={{ fontSize: 12, color: '#565959' }}>
                        {selectedAddress?.line1}, {selectedAddress?.city} - {selectedAddress?.postalCode}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#565959', textTransform: 'uppercase' }}>Payment Method</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0f1111', marginTop: 3 }}>
                        {paymentMethod === 'upi' ? 'Instant UPI Escrow' : paymentMethod === 'card' ? 'Credit/Debit Card' : 'Cash on Delivery'}
                      </div>
                      <div style={{ fontSize: 12, color: '#007600' }}>Verified Payment Channel</div>
                    </div>
                  </div>

                  {/* Multi-Vendor Packages Breakdown */}
                  <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Order Packages ({Object.keys(itemsByVendor).length} independent makers)</h4>
                  {Object.entries(itemsByVendor).map(([vendorId, vendorItems], vIdx) => {
                    const packageSubtotal = vendorItems.reduce((s, i) => s + i.product.pricePaise * i.quantity, 0);
                    const commissionCut = Math.round(packageSubtotal * 0.1);
                    const vendorPayout = packageSubtotal - commissionCut;

                    return (
                      <div key={vendorId} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: 14, marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0', paddingBottom: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#0f1111' }}>
                            Package {vIdx + 1} of {Object.keys(itemsByVendor).length}
                          </span>
                          <span style={{ fontSize: 12, color: '#007600', fontWeight: 600 }}>Guaranteed Delivery by Tomorrow</span>
                        </div>
                        {vendorItems.map(item => (
                          <div key={item.product._id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                            <span>{item.quantity} × {item.product.name}</span>
                            <b>{formatPrice(item.product.pricePaise * item.quantity)}</b>
                          </div>
                        ))}
                        <div style={{ borderTop: '1px dashed #e5e7eb', paddingTop: 6, marginTop: 6, fontSize: 11, color: '#565959', display: 'flex', justifyContent: 'space-between' }}>
                          <span>Maker Net Payout (90%): {formatPrice(vendorPayout)}</span>
                          <span>Marketplace Platform Commission (10%): {formatPrice(commissionCut)}</span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Totals Summary */}
                  <div style={{ background: '#ffffff', border: '1px solid #d5d9d9', borderRadius: 6, padding: 16, marginTop: 16 }}>
                    <div className="amz-cart-summary-line">
                      <span>Items Subtotal:</span>
                      <b>{formatPrice(subtotalPaise)}</b>
                    </div>
                    {discountPaise > 0 && (
                      <div className="amz-cart-summary-line" style={{ color: '#007600' }}>
                        <span>Promotional Discount:</span>
                        <b>-{formatPrice(discountPaise)}</b>
                      </div>
                    )}
                    <div className="amz-cart-summary-line">
                      <span>Shipping & Handling:</span>
                      <span>{shippingPaise === 0 ? <strong style={{ color: '#007600' }}>FREE</strong> : formatPrice(shippingPaise)}</span>
                    </div>
                    <div className="amz-cart-total-line">
                      <span>Order Total:</span>
                      <span style={{ color: '#b12704', fontSize: 22 }}>{formatPrice(finalTotalPaise)}</span>
                    </div>

                    <button
                      className="amz-btn-buy"
                      onClick={handleCompleteOrder}
                      disabled={isProcessing}
                      style={{ fontSize: 15, padding: '12px 24px', width: '100%' }}
                    >
                      {isProcessing ? 'Processing & Confirming Payment…' : `Place Your Order and Pay (${formatPrice(finalTotalPaise)})`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
