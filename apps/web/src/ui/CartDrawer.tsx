import React, { useState } from 'react';
import { ArrowRight, Minus, Plus, ShieldCheck, Tag, Trash2, X } from 'lucide-react';
import {
  useAddAddressMutation,
  useAddressesQuery,
  useApplyCouponMutation,
  useCartQuery,
  useCheckoutMutation,
  useCouponsQuery,
  useMeQuery,
  useUpdateCartMutation,
} from '../api';
import { formatPrice } from '../utils';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth: () => void;
  onOrderSuccess: (orderId: string) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose, onOpenAuth, onOrderSuccess }) => {
  const { data: identity } = useMeQuery();
  const isCustomer = identity?.user?.role === 'CUSTOMER';
  const { data: cartData } = useCartQuery(undefined, { skip: !isCustomer });
  const { data: addressData } = useAddressesQuery(undefined, { skip: !isCustomer || !isOpen });
  const { data: couponsData } = useCouponsQuery();

  const [updateCart] = useUpdateCartMutation();
  const [addAddress, addAddressState] = useAddAddressMutation();
  const [checkout, checkoutState] = useCheckoutMutation();
  const [applyCoupon, applyCouponState] = useApplyCouponMutation();

  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; discountPaise: number } | null>(null);
  const [couponError, setCouponError] = useState('');
  const [notice, setNotice] = useState('');
  const [showAddressForm, setShowAddressForm] = useState(false);

  if (!isOpen) return null;

  if (!isCustomer) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <section className="auth-modal" role="dialog" onClick={e => e.stopPropagation()}>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
          <div className="eyebrow"><span className="eyebrow-line" /> SIGN IN REQUIRED</div>
          <h2>Your bag is waiting.</h2>
          <p style={{ margin: '8px 0 20px', color: '#6b7280' }}>Please sign in as a customer to manage your bag and place orders.</p>
          <button className="primary-button" onClick={() => { onClose(); onOpenAuth(); }}>
            Sign In to Continue <ArrowRight size={16} />
          </button>
        </section>
      </div>
    );
  }

  const items = cartData?.items ?? [];
  const subtotalPaise = items.reduce((sum, item) => sum + item.product.pricePaise * item.quantity, 0);
  const discountPaise = appliedDiscount ? appliedDiscount.discountPaise : 0;
  const finalTotalPaise = Math.max(0, subtotalPaise - discountPaise);

  const selectedAddress = addressData?.items.find(a => a.isDefault) ?? addressData?.items[0];

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
      // re-validate coupon
      handleApplyCoupon(appliedDiscount.code);
    }
  };

  const handleApplyCoupon = async (codeToApply?: string) => {
    const code = (codeToApply || couponCode).trim().toUpperCase();
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
      await addAddress({
        label: 'Home',
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
      setShowAddressForm(false);
      setNotice('Address saved successfully.');
    } catch {
      setNotice('Could not save address. Please verify the input fields.');
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddress || !items.length) return;
    setNotice('');
    try {
      const result = await checkout({
        addressId: selectedAddress._id,
        items: items.map(item => ({ productId: item.product._id, quantity: item.quantity })),
        idempotencyKey: crypto.randomUUID(),
        couponCode: appliedDiscount?.code,
      }).unwrap();

      // Clear local cart
      await updateCart({ items: [] });
      onClose();
      onOrderSuccess(result.order._id);
    } catch (err: any) {
      setNotice(err?.data?.error?.message || 'Checkout could not be completed. Please check product stock.');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="auth-modal cart-modal"
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
        style={{ width: 'min(100%, 640px)', maxHeight: '92vh', overflowY: 'auto' }}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close bag"><X size={18} /></button>

        <div className="eyebrow"><span className="eyebrow-line" /> YOUR SHOPPING COLLECTION</div>
        <h2 style={{ fontSize: 26, margin: '8px 0 16px' }}>Shopping Bag ({items.reduce((s, i) => s + i.quantity, 0)})</h2>

        {items.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 20px', textAlign: 'center' }}>
            <p style={{ color: '#6b7280', fontSize: 14 }}>Your bag is currently empty. Explore our maker collection to discover thoughtful objects.</p>
          </div>
        ) : (
          <>
            <div className="cart-items" style={{ display: 'grid', gap: 14, marginBottom: 20 }}>
              {items.map(item => (
                <div
                  key={item.product._id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '70px 1fr auto',
                    gap: 16,
                    alignItems: 'center',
                    borderBottom: '1px solid #e5e7eb',
                    paddingBottom: 12,
                  }}
                >
                  <img
                    src={item.product.imageUrl}
                    alt={item.product.name}
                    style={{ width: 70, height: 75, objectFit: 'cover', borderRadius: 4, background: '#f3f4f6' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{item.product.name}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', margin: '2px 0' }}>{item.product.category}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
                      {formatPrice(item.product.pricePaise)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #d1d5db', borderRadius: 4 }}>
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(item.product._id, item.quantity - 1)}
                        style={{ padding: '4px 8px', background: 'none', border: 0 }}
                      >
                        <Minus size={12} />
                      </button>
                      <span style={{ fontSize: 12, fontWeight: 600, padding: '0 6px' }}>{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(item.product._id, item.quantity + 1)}
                        style={{ padding: '4px 8px', background: 'none', border: 0 }}
                      >
                        <Plus size={12} />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleQuantityChange(item.product._id, 0)}
                      title="Remove line"
                      style={{ background: 'none', border: 0, color: '#9ca3af', padding: 4 }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Promo Code Box */}
            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '12px 14px', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                <Tag size={14} color="#50684d" /> Have a Promo Code?
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={couponCode}
                  onChange={e => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="e.g. WELCOME10"
                  style={{
                    flex: 1,
                    border: '1px solid #d1d5db',
                    padding: '8px 12px',
                    fontSize: 12,
                    borderRadius: 4,
                    textTransform: 'uppercase',
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleApplyCoupon()}
                  disabled={applyCouponState.isLoading || !couponCode.trim()}
                  style={{
                    background: '#50684d',
                    color: '#fff',
                    border: 0,
                    padding: '8px 16px',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 4,
                  }}
                >
                  Apply
                </button>
              </div>

              {/* Suggested active coupon pills */}
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                {couponsData?.items.map(c => (
                  <button
                    key={c._id}
                    type="button"
                    onClick={() => {
                      setCouponCode(c.code);
                      handleApplyCoupon(c.code);
                    }}
                    style={{
                      background: appliedDiscount?.code === c.code ? '#e2ebd8' : '#fff',
                      border: `1px dashed ${appliedDiscount?.code === c.code ? '#455d46' : '#d1d5db'}`,
                      borderRadius: 12,
                      padding: '3px 8px',
                      fontSize: 10,
                      fontWeight: 600,
                      color: appliedDiscount?.code === c.code ? '#2f4432' : '#4b5563',
                      cursor: 'pointer',
                    }}
                  >
                    🏷️ {c.code} ({c.discountType === 'PERCENTAGE' ? `${c.discountValue}% OFF` : `₹${c.discountValue / 100} OFF`})
                  </button>
                ))}
              </div>

              {couponError && (
                <div style={{ fontSize: 11, color: '#dc2626', marginTop: 6 }}>{couponError}</div>
              )}
            </div>

            {/* Delivery Address Section */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Delivery Address</span>
                {!showAddressForm && (
                  <button
                    type="button"
                    onClick={() => setShowAddressForm(true)}
                    style={{ background: 'none', border: 0, fontSize: 12, color: '#50684d', fontWeight: 600, textDecoration: 'underline' }}
                  >
                    + Add New Address
                  </button>
                )}
              </div>

              {showAddressForm ? (
                <form onSubmit={handleSaveAddress} style={{ background: '#f9fafb', padding: 14, borderRadius: 6, border: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <label style={{ fontSize: 11, display: 'grid', gap: 4 }}>
                      Recipient Name
                      <input name="recipient" required placeholder="Full Name" style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 4 }} />
                    </label>
                    <label style={{ fontSize: 11, display: 'grid', gap: 4 }}>
                      Phone
                      <input name="phone" required placeholder="+91 98765 43210" style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 4 }} />
                    </label>
                  </div>
                  <label style={{ fontSize: 11, display: 'grid', gap: 4, marginTop: 8 }}>
                    Street Address
                    <input name="line1" required placeholder="House / Flat / Street" style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 4 }} />
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 8 }}>
                    <label style={{ fontSize: 11, display: 'grid', gap: 4 }}>
                      City
                      <input name="city" required placeholder="City" style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 4 }} />
                    </label>
                    <label style={{ fontSize: 11, display: 'grid', gap: 4 }}>
                      State
                      <input name="state" required placeholder="State" style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 4 }} />
                    </label>
                    <label style={{ fontSize: 11, display: 'grid', gap: 4 }}>
                      Postal Code
                      <input name="postalCode" required placeholder="PIN Code" style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 4 }} />
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button type="submit" disabled={addAddressState.isLoading} className="primary-button" style={{ padding: '8px 16px', fontSize: 12 }}>
                      Save Address
                    </button>
                    <button type="button" onClick={() => setShowAddressForm(false)} style={{ background: 'none', border: '1px solid #d1d5db', padding: '8px 12px', fontSize: 12, borderRadius: 4 }}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : selectedAddress ? (
                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '10px 14px', fontSize: 12 }}>
                  <div style={{ fontWeight: 600, color: '#111827' }}>{selectedAddress.recipient} ({selectedAddress.phone})</div>
                  <div style={{ color: '#4b5563', marginTop: 2 }}>{selectedAddress.line1}, {selectedAddress.city}, {selectedAddress.state} - {selectedAddress.postalCode}</div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#dc2626' }}>
                  Please add a shipping address to proceed to checkout.
                </div>
              )}
            </div>

            {/* Price Breakdown */}
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 14, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#4b5563', marginBottom: 6 }}>
                <span>Items Subtotal</span>
                <span>{formatPrice(subtotalPaise)}</span>
              </div>
              {appliedDiscount && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#16a34a', marginBottom: 6, fontWeight: 600 }}>
                  <span>Coupon Discount ({appliedDiscount.code})</span>
                  <span>-{formatPrice(appliedDiscount.discountPaise)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#4b5563', marginBottom: 8 }}>
                <span>Delivery Charges</span>
                <span style={{ color: '#16a34a', fontWeight: 600 }}>FREE</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, color: '#111827', borderTop: '1px dashed #d1d5db', paddingTop: 8 }}>
                <span>Total Amount</span>
                <span>{formatPrice(finalTotalPaise)}</span>
              </div>
            </div>

            {notice && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '8px 12px', borderRadius: 4, fontSize: 12, marginBottom: 14 }}>
                {notice}
              </div>
            )}

            <button
              className="primary-button"
              disabled={checkoutState.isLoading || !selectedAddress || !items.length}
              onClick={handlePlaceOrder}
              style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: 14, gap: 10 }}
            >
              <ShieldCheck size={18} />
              {checkoutState.isLoading ? 'Processing Order…' : `Pay ${formatPrice(finalTotalPaise)} & Place Order`}
            </button>
          </>
        )}
      </section>
    </div>
  );
};
