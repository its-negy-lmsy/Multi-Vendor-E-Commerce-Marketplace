import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Download,
  Package,
  Search,
  ShoppingCart,
  XCircle,
} from 'lucide-react';
import { useCancelOrderMutation, useOrdersQuery, useUpdateCartMutation, useCartQuery } from '../api';
import { formatPrice } from '../utils';

export const CustomerOrders: React.FC = () => {
  const navigate = useNavigate();
  const { data: ordersData, isLoading } = useOrdersQuery();
  const { data: cartData } = useCartQuery();
  const [updateCart] = useUpdateCartMutation();
  const [cancelOrder, { isLoading: isCancelling }] = useCancelOrderMutation();

  const [searchFilter, setSearchFilter] = useState('');
  const [activeTrackingOrder, setActiveTrackingOrder] = useState<any | null>(null);
  const [actionNotice, setActionNotice] = useState('');

  const rawOrders = ordersData?.items ?? [];
  const orders = rawOrders.filter(order => {
    if (!searchFilter.trim()) return true;
    const term = searchFilter.toLowerCase();
    const matchesId = order._id.toLowerCase().includes(term) || (order.invoiceNumber || '').toLowerCase().includes(term);
    const matchesItem = order.items.some(i => i.name.toLowerCase().includes(term));
    return matchesId || matchesItem;
  });

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

  const handleBuyAgain = async (item: any) => {
    const items = (cartData?.items ?? []).map(i => ({ productId: i.product._id, quantity: i.quantity }));
    const match = items.find(i => i.productId === item.productId);
    if (match) {
      match.quantity += 1;
    } else {
      items.push({ productId: item.productId, quantity: 1 });
    }
    await updateCart({ items });
    navigate('/');
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!window.confirm('Are you sure you want to cancel this order? The order will be immediately cancelled and a full refund will be processed.')) {
      return;
    }
    try {
      await cancelOrder(orderId).unwrap();
      setActionNotice('Your order has been cancelled and refunded successfully.');
    } catch (err: any) {
      setActionNotice(err?.data?.error?.message || 'Could not cancel this order.');
    }
  };

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 20px 80px' }}>
      {/* Breadcrumb Navigation */}
      <div style={{ marginBottom: 16 }}>
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#455d46' }}>
          <ArrowLeft size={14} /> Back to Storefront
        </Link>
      </div>

      {actionNotice && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px 16px', borderRadius: 6, fontSize: 13, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{actionNotice}</span>
          <button onClick={() => setActionNotice('')} style={{ color: '#991b1b', cursor: 'pointer', fontWeight: 700 }}>✕</button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#0f1111' }}>Your Orders</h1>
          <p style={{ fontSize: 13, color: '#565959', marginTop: 4 }}>
            Track deliveries, download official GST invoices, and leave verified artisan reviews.
          </p>
        </div>

        {/* Search orders input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: '#767676' }} />
            <input
              type="text"
              placeholder="Search all orders…"
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              style={{
                padding: '7px 12px 7px 32px',
                border: '1px solid #888c8c',
                borderRadius: 4,
                fontSize: 13,
                width: 260,
              }}
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', background: '#fff', borderRadius: 6 }}>
          <h3>Loading your order history…</h3>
        </div>
      ) : orders.length === 0 ? (
        <div style={{ background: '#fff', padding: '48px 24px', borderRadius: 8, textAlign: 'center', border: '1px solid #d5d9d9' }}>
          <Package size={48} color="#cccccc" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: 18, color: '#0f1111', marginBottom: 8 }}>No orders found</h3>
          <p style={{ color: '#565959', fontSize: 13, marginBottom: 20 }}>
            {searchFilter ? 'No orders match your search criteria.' : 'You haven’t placed any orders yet. Discover our curated collection!'}
          </p>
          <Link to="/" className="amz-btn-cart" style={{ display: 'inline-flex', width: 'auto', padding: '10px 24px' }}>
            Explore Curated Artisan Collection
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 20 }}>
          {orders.map(order => {
            const step = getStatusStep(order.status);
            const isDelivered = order.status === 'DELIVERED';
            const isShipped = order.status === 'SHIPPED';

            return (
              <div
                key={order._id}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e7e4db',
                  borderRadius: 8,
                  overflow: 'hidden',
                  boxShadow: '0 2px 6px rgba(36,43,35,0.04)',
                }}
              >
                {/* Order Header Strip */}
                <div
                  style={{
                    background: '#f8f6f0',
                    padding: '14px 20px',
                    borderBottom: '1px solid #e7e4db',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 16,
                    fontSize: 12,
                    color: '#72766d',
                  }}
                >
                  <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>Order Placed</div>
                      <b style={{ color: '#242b23', fontSize: 13 }}>
                        {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </b>
                    </div>
                    <div>
                      <div style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total</div>
                      <b style={{ color: '#242b23', fontSize: 13 }}>{formatPrice(order.totalPaise)}</b>
                    </div>
                    <div>
                      <div style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>Ship To</div>
                      <b style={{ color: '#455d46', fontSize: 13, cursor: 'pointer' }}>
                        {order.addressSnapshot.recipient} ▾
                      </b>
                    </div>
                  </div>

                    <div style={{ textAlign: 'right' }}>
                      <div>
                        ORDER # <strong style={{ color: '#0f1111' }}>{order.invoiceNumber || order._id.slice(-8).toUpperCase()}</strong>
                      </div>
                      <div style={{ marginTop: 4, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                        {(() => {
                          const token = sessionStorage.getItem('fs01_access');
                          const invoiceUrl = `http://localhost:4000/api/v1/orders/${order._id}/invoice${token ? `?token=${encodeURIComponent(token)}` : ''}`;
                          return (
                            <a
                              href={invoiceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#455d46', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            >
                              <Download size={13} /> View Invoice
                            </a>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div style={{ padding: '20px 24px' }}>
                    {/* Delivery Status Banner */}
                    {(() => {
                      const isCancelled = order.status === 'CANCELLED';
                      const canCancel = (order.status === 'PLACED' || order.status === 'PAYMENT_PENDING') && !order.items.some(i => ['SHIPPED', 'DELIVERED'].includes(i.fulfillmentStatus));

                      return (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <div>
                              <h3 style={{ fontSize: 17, fontWeight: 700, color: isCancelled ? '#b12704' : isDelivered ? '#007600' : '#0f1111' }}>
                                {isCancelled ? 'Order Cancelled & Refunded' : isDelivered ? 'Delivered successfully' : isShipped ? 'Package in transit with BlueDart' : 'Preparing for dispatch'}
                              </h3>
                              <div style={{ fontSize: 13, color: '#565959', marginTop: 2 }}>
                                {isCancelled
                                  ? `A full refund of ${formatPrice(order.totalPaise)} was credited to your payment method.`
                                  : isDelivered
                                  ? 'Handed directly to resident'
                                  : 'Expected delivery: Tomorrow by 2 PM'}
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              {!isCancelled && (
                                <button
                                  onClick={() => setActiveTrackingOrder(order)}
                                  style={{
                                    padding: '6px 14px',
                                    border: '1px solid #d5d9d9',
                                    borderRadius: 4,
                                    background: '#ffffff',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: '#0f1111',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Track Package
                                </button>
                              )}
                              {canCancel && (
                                <button
                                  onClick={() => handleCancelOrder(order._id)}
                                  disabled={isCancelling}
                                  style={{
                                    padding: '6px 14px',
                                    border: '1px solid #fca5a5',
                                    borderRadius: 4,
                                    background: '#fff',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: '#b91c1c',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Cancel Order
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Visual 4-Stage Fulfillment Tracker or Cancelled Notice */}
                          {isCancelled ? (
                            <div style={{ margin: '16px 0 24px', background: '#fef2f2', padding: '14px 18px', borderRadius: 6, border: '1px solid #fee2e2', display: 'flex', alignItems: 'center', gap: 10, color: '#991b1b', fontSize: 13 }}>
                              <XCircle size={18} />
                              <span>This order was cancelled before dispatch. All reserved artisan inventory has been released and escrow payments refunded.</span>
                            </div>
                          ) : (
                            <div style={{ margin: '16px 0 24px', background: '#f8f9fa', padding: '16px 20px', borderRadius: 6, border: '1px solid #eee' }}>
                              <div className="amz-order-tracker-bar">
                                <div className="amz-tracker-line">
                                  <div
                                    className="amz-tracker-fill"
                                    style={{ width: `${Math.max(0, ((step - 1) / 3) * 100)}%` }}
                                  />
                                </div>

                                {[
                                  { num: 1, label: 'Order Placed', desc: 'Verified & Escrowed' },
                                  { num: 2, label: 'Packed by Maker', desc: 'Custom wrapping' },
                                  { num: 3, label: 'Shipped', desc: 'Express Courier' },
                                  { num: 4, label: 'Delivered', desc: 'At your doorstep' },
                                ].map(st => {
                                  const isDone = step >= st.num;
                                  const isCurrent = step === st.num;
                                  return (
                                    <div key={st.num} className="amz-tracker-node">
                                      <div className={`amz-tracker-circle ${isDone ? 'done' : ''}`}>
                                        {isDone ? '✓' : st.num}
                                      </div>
                                      <div style={{ fontSize: 12, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? '#0f1111' : '#565959' }}>
                                        {st.label}
                                      </div>
                                      <div style={{ fontSize: 10, color: '#767676' }}>{st.desc}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}

                    {/* Order Items */}
                    <div style={{ display: 'grid', gap: 16 }}>
                      {order.items.map(item => (
                        <div
                          key={item._id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '70px 1fr auto',
                            gap: 16,
                            alignItems: 'center',
                            paddingBottom: 14,
                            borderBottom: '1px solid #f0f0f0',
                          }}
                        >
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: 4, border: '1px solid #e5e7eb' }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 70,
                                height: 70,
                                background: '#f8f8f8',
                                borderRadius: 4,
                                border: '1px solid #eee',
                                display: 'grid',
                                placeItems: 'center',
                              }}
                            >
                              <Package size={32} color="#999" />
                            </div>
                          )}

                        <div>
                          <Link
                            to={`/product/${item.productId}`}
                            style={{ fontSize: 14, fontWeight: 700, color: '#455d46', lineHeight: 1.3 }}
                          >
                            {item.name}
                          </Link>
                          <div style={{ fontSize: 12, color: '#72766d', marginTop: 4 }}>
                            Qty: {item.quantity} · Price: {formatPrice(item.unitPricePaise)}
                          </div>
                          <div style={{ fontSize: 11, color: '#2e6338', fontWeight: 600, marginTop: 2 }}>
                            Status: {item.fulfillmentStatus}
                            {item.trackingNumber && ` (Tracking: ${item.trackingNumber})`}
                          </div>
                        </div>

                        <div style={{ display: 'grid', gap: 8 }}>
                          <button
                            className="amz-btn-cart"
                            onClick={() => handleBuyAgain(item)}
                            style={{ width: 'auto', padding: '6px 14px', fontSize: 12 }}
                          >
                            <ShoppingCart size={13} /> Buy it again
                          </button>
                          <Link
                            to={`/product/${item.productId}#reviews`}
                            style={{
                              padding: '5px 12px',
                              border: '1px solid #e7e4db',
                              borderRadius: 4,
                              background: '#fff',
                              fontSize: 12,
                              textAlign: 'center',
                              color: '#242b23',
                            }}
                          >
                            Write a product review
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tracking Modal */}
      {activeTrackingOrder && (
        <div className="amz-modal-backdrop" onClick={() => setActiveTrackingOrder(null)}>
          <div className="amz-checkout-modal" style={{ maxWidth: 500, padding: 24 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Tracking details</h3>
              <button onClick={() => setActiveTrackingOrder(null)}><Check size={20} /></button>
            </div>
            <div style={{ fontSize: 13, color: '#565959', marginBottom: 14 }}>
              Order Reference: <strong>#{activeTrackingOrder._id.slice(-8).toUpperCase()}</strong>
            </div>
            <div style={{ background: '#f8f9fa', border: '1px solid #eee', borderRadius: 6, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#007600', marginBottom: 4 }}>
                Carrier: BlueDart Express Ground
              </div>
              <div style={{ fontSize: 12, color: '#565959' }}>
                Tracking ID: <strong>BLUEDART-IND-{activeTrackingOrder._id.slice(-6).toUpperCase()}</strong>
              </div>
              <div style={{ fontSize: 12, color: '#565959', marginTop: 2 }}>
                Destination: {activeTrackingOrder.addressSnapshot.city}, {activeTrackingOrder.addressSnapshot.postalCode}
              </div>
            </div>
            <button
              className="amz-btn-cart"
              onClick={() => setActiveTrackingOrder(null)}
              style={{ width: '100%' }}
            >
              Close Tracking Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
