import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Package } from 'lucide-react';
import { useOrdersQuery } from '../api';
import { formatPrice } from '../utils';

export const CustomerOrders: React.FC = () => {
  const { data: ordersData, isLoading } = useOrdersQuery();
  const orders = ordersData?.items ?? [];

  const getStatusStep = (status: string) => {
    switch (status) {
      case 'PAYMENT_PENDING': return 0;
      case 'PLACED': return 1;
      case 'PACKED': return 2;
      case 'SHIPPED': return 3;
      case 'DELIVERED': return 4;
      default: return 1;
    }
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '36px 20px 80px' }}>
      <div style={{ marginBottom: 24 }}>
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6b7280' }}>
          <ArrowLeft size={14} /> Back to Storefront
        </Link>
      </div>

      <div className="eyebrow"><span className="eyebrow-line" /> YOUR PURCHASES</div>
      <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, margin: '8px 0 24px', color: '#111827' }}>
        Order History & Tracking
      </h1>

      {isLoading ? (
        <div className="loading-state" style={{ padding: 40, textAlign: 'center' }}>Loading your orders…</div>
      ) : orders.length === 0 ? (
        <div className="empty-state" style={{ background: '#f9fafb', padding: '48px 24px', borderRadius: 8, textAlign: 'center' }}>
          <Package size={36} color="#9ca3af" style={{ margin: '0 auto 12px' }} />
          <h3>No orders placed yet</h3>
          <p style={{ color: '#6b7280', fontSize: 14, margin: '6px 0 20px' }}>When you purchase curated items, you can track fulfillment stages and download tax invoices here.</p>
          <Link to="/" className="primary-button">Explore Curated Collection</Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 24 }}>
          {orders.map(order => {
            const step = getStatusStep(order.status);
            return (
              <div
                key={order._id}
                style={{
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                {/* Order Header */}
                <div style={{ background: '#f9fafb', padding: '16px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Order Reference</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>#{order._id.slice(-8).toUpperCase()}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>Placed on {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#6b7280', textAlign: 'right' }}>Total Paid</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>{formatPrice(order.totalPaise)}</div>
                    </div>

                    <a
                      href={`http://localhost:4000/api/v1/orders/${order._id}/invoice`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="primary-button"
                      style={{ padding: '8px 14px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <Download size={14} /> Tax Invoice
                    </a>
                  </div>
                </div>

                {/* Lifecycle Progress Bar */}
                <div style={{ padding: '24px 24px 16px', background: '#fafaf9', borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
                    <div
                      style={{
                        position: 'absolute',
                        top: 14,
                        left: '10%',
                        right: '10%',
                        height: 3,
                        background: '#e5e7eb',
                        zIndex: 1,
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          background: '#50684d',
                          width: `${((step - 1) / 3) * 100}%`,
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>

                    {[
                      { num: 1, label: 'Order Placed', desc: 'Payment verified' },
                      { num: 2, label: 'Packed by Maker', desc: 'Crafting & wrapping' },
                      { num: 3, label: 'Shipped', desc: 'In courier transit' },
                      { num: 4, label: 'Delivered', desc: 'At your doorstep' },
                    ].map(st => {
                      const isComplete = step >= st.num;
                      const isCurrent = step === st.num;
                      return (
                        <div key={st.num} style={{ position: 'relative', zIndex: 2, textAlign: 'center', width: '22%' }}>
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              background: isComplete ? '#50684d' : '#fff',
                              color: isComplete ? '#fff' : '#9ca3af',
                              border: `2px solid ${isComplete ? '#50684d' : '#d1d5db'}`,
                              display: 'grid',
                              placeItems: 'center',
                              margin: '0 auto 6px',
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          >
                            {isComplete ? '✓' : st.num}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? '#111827' : '#6b7280' }}>
                            {st.label}
                          </div>
                          <div style={{ fontSize: 10, color: '#9ca3af' }}>{st.desc}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Items & Shipping Details */}
                <div style={{ padding: 24 }}>
                  <div style={{ display: 'grid', gap: 14 }}>
                    {order.items.map(item => (
                      <div key={item._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>
                            {item.quantity} × {item.name}
                          </div>
                          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                            Status: <span style={{ fontWeight: 600, color: '#50684d' }}>{item.fulfillmentStatus}</span>
                            {item.trackingNumber && <span> · Tracking: <code>{item.trackingNumber}</code> ({item.courier || 'Express'})</span>}
                          </div>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#374151' }}>
                          {formatPrice(item.unitPricePaise * item.quantity)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {order.discountPaise > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#16a34a', borderTop: '1px solid #f3f4f6', paddingTop: 12, marginTop: 14 }}>
                      <span>Coupon Discount ({order.couponCode || 'PROMO'})</span>
                      <span>-{formatPrice(order.discountPaise)}</span>
                    </div>
                  )}

                  <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 14, marginTop: 14, fontSize: 12, color: '#6b7280' }}>
                    <strong>Delivering to:</strong> {order.addressSnapshot.recipient} · {order.addressSnapshot.line1}, {order.addressSnapshot.city}, {order.addressSnapshot.state} - {order.addressSnapshot.postalCode}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
