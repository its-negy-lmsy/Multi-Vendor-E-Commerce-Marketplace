import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  Package,
  Plus,
  Shield,
  Tag,
  Users,
  X,
} from 'lucide-react';
import {
  useAdminAnalyticsQuery,
  useAdminVendorsQuery,
  useAuditLogsQuery,
  useCouponsQuery,
  useCreateCouponMutation,
  useMeQuery,
  useModerateProductMutation,
  useProductsQuery,
  useUpdateVendorStatusMutation,
} from '../api';
import { formatPrice } from '../utils';

export const AdminDashboard: React.FC = () => {
  const { data: identity } = useMeQuery();
  const isAdmin = identity?.user?.role === 'ADMIN';

  const { data: analyticsData } = useAdminAnalyticsQuery(undefined, { skip: !isAdmin });
  const { data: vendorsData } = useAdminVendorsQuery(undefined, { skip: !isAdmin });
  const { data: productsData } = useProductsQuery({});
  const { data: couponsData } = useCouponsQuery();
  const { data: auditData } = useAuditLogsQuery(undefined, { skip: !isAdmin });

  const [updateVendorStatus] = useUpdateVendorStatusMutation();
  const [moderateProduct] = useModerateProductMutation();
  const [createCoupon, { isLoading: isCreatingCoupon }] = useCreateCouponMutation();

  const [activeTab, setActiveTab] = useState<'analytics' | 'vendors' | 'products' | 'coupons' | 'audit'>('analytics');
  const [notice, setNotice] = useState('');
  const [showCouponModal, setShowCouponModal] = useState(false);

  // Coupon form state
  const [couponCode, setCouponCode] = useState('');
  const [couponDesc, setCouponDesc] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FLAT'>('PERCENTAGE');
  const [discountVal, setDiscountVal] = useState('15');
  const [minOrderInr, setMinOrderInr] = useState('1000');
  const [maxDiscountInr, setMaxDiscountInr] = useState('500');

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const discountValue = discountType === 'PERCENTAGE'
        ? parseInt(discountVal, 10)
        : Math.round(parseFloat(discountVal) * 100);
      const minOrderPaise = minOrderInr ? Math.round(parseFloat(minOrderInr) * 100) : 0;
      const maxDiscountPaise = maxDiscountInr ? Math.round(parseFloat(maxDiscountInr) * 100) : 0;

      await createCoupon({
        code: couponCode.trim().toUpperCase(),
        description: couponDesc.trim(),
        discountType,
        discountValue,
        minOrderPaise,
        maxDiscountPaise,
        isActive: true,
      }).unwrap();

      setShowCouponModal(false);
      setCouponCode('');
      setCouponDesc('');
      setNotice(`Promotional coupon ${couponCode.toUpperCase()} successfully issued!`);
    } catch (err: any) {
      setNotice(err?.data?.error?.message || 'Could not create coupon.');
    }
  };

  if (!isAdmin) {
    return (
      <div style={{ maxWidth: 700, margin: '80px auto', textAlign: 'center', padding: 24 }}>
        <Shield size={44} color="#99583d" style={{ margin: '0 auto 12px' }} />
        <h2>Administrator Access Required</h2>
        <p style={{ color: '#6b7280', margin: '8px 0 20px' }}>
          This command center requires administrator privileges. Please sign in with an administrator account (e.g. <code>admin@fs01.local</code>).
        </p>
        <Link to="/" className="primary-button">Back to Marketplace</Link>
      </div>
    );
  }

  const summary = analyticsData?.summary || {
    orderCount: 0,
    gmvPaise: 0,
    commissionPaise: 0,
    revenueSubtotalPaise: 0,
    averageOrderValuePaise: 0,
  };

  const handleVendorAction = async (id: string, status: 'APPROVED' | 'REJECTED' | 'SUSPENDED') => {
    try {
      await updateVendorStatus({ id, status }).unwrap();
      setNotice(`Vendor status successfully updated to ${status}.`);
    } catch (err: any) {
      setNotice(err?.data?.error?.message || 'Failed to update vendor status.');
    }
  };

  const handleToggleProductStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'PUBLISHED' ? 'ARCHIVED' : 'PUBLISHED';
    try {
      await moderateProduct({ id, status: nextStatus }).unwrap();
      setNotice(`Product status updated to ${nextStatus}.`);
    } catch (err: any) {
      setNotice(err?.data?.error?.message || 'Failed to moderate product.');
    }
  };

  return (
    <div style={{ maxWidth: 1160, margin: '0 auto', padding: '30px 20px 80px' }}>
      <div style={{ marginBottom: 20 }}>
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6b7280' }}>
          <ArrowLeft size={14} /> Back to Storefront
        </Link>
      </div>

      <div className="eyebrow"><span className="eyebrow-line" /> PLATFORM OPERATOR</div>
      <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, margin: '6px 0 24px', color: '#111827' }}>
        Marketplace Command Center
      </h1>

      {notice && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '10px 16px', borderRadius: 6, fontSize: 13, marginBottom: 20 }}>
          {notice}
        </div>
      )}

      {/* KPI Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '20px 22px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Gross Merchandise Value</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#111827', margin: '6px 0 2px' }}>
            {formatPrice(summary.gmvPaise)}
          </div>
          <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>Total processed volume</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '20px 22px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Platform Commission</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#50684d', margin: '6px 0 2px' }}>
            {formatPrice(summary.commissionPaise)}
          </div>
          <div style={{ fontSize: 11, color: '#50684d', fontWeight: 600 }}>10% Platform revenue cut</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '20px 22px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Completed Orders</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#111827', margin: '6px 0 2px' }}>
            {summary.orderCount}
          </div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>AOV: {formatPrice(summary.averageOrderValuePaise)}</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '20px 22px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Artisan Vendors</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#99583d', margin: '6px 0 2px' }}>
            {vendorsData?.items?.length || 0}
          </div>
          <div style={{ fontSize: 11, color: '#99583d', fontWeight: 600 }}>Approved seller accounts</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: 24, gap: 8, overflowX: 'auto' }}>
        {[
          { key: 'analytics', label: 'Analytics & Sales', icon: BarChart3 },
          { key: 'vendors', label: `Vendor Onboarding (${vendorsData?.items?.length || 0})`, icon: Users },
          { key: 'products', label: `Product Moderation (${productsData?.total || 0})`, icon: Package },
          { key: 'coupons', label: `Promotional Coupons (${couponsData?.items?.length || 0})`, icon: Tag },
          { key: 'audit', label: 'Audit Trail', icon: Shield },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: '12px 18px',
              border: 0,
              background: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #50684d' : '2px solid transparent',
              color: activeTab === tab.key ? '#50684d' : '#6b7280',
              fontWeight: activeTab === tab.key ? 700 : 500,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              whiteSpace: 'nowrap',
            }}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Analytics */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Best Sellers */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px', color: '#111827' }}>Top Performing Products</h3>
            {(!analyticsData?.bestSellers || analyticsData.bestSellers.length === 0) ? (
              <div style={{ color: '#6b7280', fontSize: 13 }}>No sales recorded yet.</div>
            ) : (
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb', color: '#6b7280', textAlign: 'left' }}>
                    <th style={{ padding: '8px 0' }}>Product</th>
                    <th style={{ padding: '8px 0', textAlign: 'right' }}>Units Sold</th>
                    <th style={{ padding: '8px 0', textAlign: 'right' }}>Gross GMV</th>
                  </tr>
                </thead>
                <tbody>
                  {analyticsData.bestSellers.map((item: any) => (
                    <tr key={item._id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 0', fontWeight: 600, color: '#111827' }}>{item.name}</td>
                      <td style={{ padding: '10px 0', textAlign: 'right', color: '#4b5563' }}>{item.units}</td>
                      <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 700, color: '#111827' }}>{formatPrice(item.grossPaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Vendor Performance */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px', color: '#111827' }}>Vendor Volume & Payouts</h3>
            {(!analyticsData?.vendorSales || analyticsData.vendorSales.length === 0) ? (
              <div style={{ color: '#6b7280', fontSize: 13 }}>No vendor sales aggregated yet.</div>
            ) : (
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb', color: '#6b7280', textAlign: 'left' }}>
                    <th style={{ padding: '8px 0' }}>Vendor ID</th>
                    <th style={{ padding: '8px 0', textAlign: 'right' }}>Sales</th>
                    <th style={{ padding: '8px 0', textAlign: 'right' }}>Payable</th>
                    <th style={{ padding: '8px 0', textAlign: 'right' }}>Platform Cut</th>
                  </tr>
                </thead>
                <tbody>
                  {analyticsData.vendorSales.map((v: any) => (
                    <tr key={v._id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 0', fontWeight: 600 }}>#{String(v._id).slice(-6)}</td>
                      <td style={{ padding: '10px 0', textAlign: 'right' }}>{formatPrice(v.itemSalesPaise)}</td>
                      <td style={{ padding: '10px 0', textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>{formatPrice(v.payablePaise)}</td>
                      <td style={{ padding: '10px 0', textAlign: 'right', color: '#50684d', fontWeight: 700 }}>{formatPrice(v.commissionPaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Vendors Onboarding */}
      {activeTab === 'vendors' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', textAlign: 'left', color: '#4b5563' }}>
                <th style={{ padding: '12px 16px' }}>Shop Name</th>
                <th style={{ padding: '12px 16px' }}>Artisan Bio</th>
                <th style={{ padding: '12px 16px' }}>Route Account ID</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Review Decision</th>
              </tr>
            </thead>
            <tbody>
              {vendorsData?.items.map(v => (
                <tr key={v._id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 700, color: '#111827' }}>{v.shopName}</td>
                  <td style={{ padding: '14px 16px', color: '#4b5563', maxWidth: 300 }}>{v.description}</td>
                  <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontSize: 11 }}>{v.razorpayLinkedAccountId || 'Pending'}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: v.status === 'APPROVED' ? '#dcfce7' : v.status === 'PENDING' ? '#fef3c7' : '#fee2e2',
                        color: v.status === 'APPROVED' ? '#15803d' : v.status === 'PENDING' ? '#b45309' : '#b91c1c',
                      }}
                    >
                      {v.status}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      {v.status !== 'APPROVED' && (
                        <button
                          className="primary-button"
                          onClick={() => handleVendorAction(v._id, 'APPROVED')}
                          style={{ padding: '4px 10px', fontSize: 11, background: '#16a34a' }}
                        >
                          Approve
                        </button>
                      )}
                      {v.status !== 'REJECTED' && (
                        <button
                          onClick={() => handleVendorAction(v._id, 'REJECTED')}
                          style={{ padding: '4px 10px', fontSize: 11, background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
                        >
                          Reject
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Product Moderation */}
      {activeTab === 'products' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', textAlign: 'left', color: '#4b5563' }}>
                <th style={{ padding: '12px 16px' }}>Item</th>
                <th style={{ padding: '12px 16px' }}>Category</th>
                <th style={{ padding: '12px 16px' }}>Price</th>
                <th style={{ padding: '12px 16px' }}>Stock</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Moderation</th>
              </tr>
            </thead>
            <tbody>
              {productsData?.items.map(prod => (
                <tr key={prod._id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <img src={prod.imageUrl} alt="" style={{ width: 40, height: 44, objectFit: 'cover', borderRadius: 4, background: '#f3f4f6' }} />
                    <strong style={{ color: '#111827' }}>{prod.name}</strong>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#6b7280' }}>{prod.category}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{formatPrice(prod.pricePaise)}</td>
                  <td style={{ padding: '12px 16px' }}>{prod.stock}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: prod.status === 'PUBLISHED' ? '#dcfce7' : '#fee2e2', color: prod.status === 'PUBLISHED' ? '#15803d' : '#b91c1c' }}>
                      {prod.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleToggleProductStatus(prod._id, prod.status)}
                      style={{
                        padding: '4px 10px',
                        fontSize: 11,
                        fontWeight: 600,
                        borderRadius: 4,
                        border: '1px solid #d1d5db',
                        background: prod.status === 'PUBLISHED' ? '#fee2e2' : '#dcfce7',
                        color: prod.status === 'PUBLISHED' ? '#b91c1c' : '#15803d',
                        cursor: 'pointer',
                      }}
                    >
                      {prod.status === 'PUBLISHED' ? 'Archive Item' : 'Publish Item'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 4: Coupons */}
      {activeTab === 'coupons' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Active Promotional Codes</h3>
              <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>Manage sitewide discounts, festival offers, and buyer incentives.</p>
            </div>
            <button
              onClick={() => setShowCouponModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                background: '#ffd814',
                border: '1px solid #fcd200',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                color: '#0f1111',
                cursor: 'pointer',
              }}
            >
              <Plus size={14} /> Create New Coupon
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {couponsData?.items.map(coupon => (
              <div key={coupon._id} style={{ border: '1px dashed #febd69', borderRadius: 8, padding: 16, background: '#fafbf9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <code style={{ fontSize: 16, fontWeight: 800, color: '#0f1111', letterSpacing: '0.05em' }}>{coupon.code}</code>
                  <span style={{ fontSize: 10, fontWeight: 700, background: '#dcfce7', color: '#15803d', padding: '2px 6px', borderRadius: 4 }}>
                    {coupon.discountType === 'PERCENTAGE' ? `${coupon.discountValue}% OFF` : `₹${coupon.discountValue / 100} OFF`}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: '#4b5563', margin: '8px 0 4px' }}>{coupon.description}</p>
                <div style={{ fontSize: 11, color: '#6b7280' }}>
                  Min Order: {formatPrice(coupon.minOrderPaise)}
                  {coupon.maxDiscountPaise ? ` · Cap: ${formatPrice(coupon.maxDiscountPaise)}` : ''}
                </div>
              </div>
            ))}
          </div>

          {/* Create Coupon Modal */}
          {showCouponModal && (
            <div className="amz-modal-backdrop" onClick={() => setShowCouponModal(false)}>
              <div className="amz-checkout-modal" style={{ maxWidth: 460, padding: 24 }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700 }}>Issue New Coupon Code</h3>
                  <button onClick={() => setShowCouponModal(false)}><X size={18} /></button>
                </div>

                <form onSubmit={handleCreateCoupon} style={{ display: 'grid', gap: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'grid', gap: 4 }}>
                    Coupon Code (Uppercase)
                    <input
                      required
                      value={couponCode}
                      onChange={e => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="e.g. FESTIVAL20"
                      style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 4 }}
                    />
                  </label>

                  <label style={{ fontSize: 12, fontWeight: 600, display: 'grid', gap: 4 }}>
                    Description
                    <input
                      required
                      value={couponDesc}
                      onChange={e => setCouponDesc(e.target.value)}
                      placeholder="e.g. Great Artisan Festival Special 20% Discount"
                      style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 4 }}
                    />
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'grid', gap: 4 }}>
                      Discount Type
                      <select
                        value={discountType}
                        onChange={e => setDiscountType(e.target.value as any)}
                        style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff' }}
                      >
                        <option value="PERCENTAGE">Percentage (%)</option>
                        <option value="FLAT">Flat Rupee Off (₹)</option>
                      </select>
                    </label>

                    <label style={{ fontSize: 12, fontWeight: 600, display: 'grid', gap: 4 }}>
                      Discount Value {discountType === 'PERCENTAGE' ? '(%)' : '(₹)'}
                      <input
                        required
                        type="number"
                        min="1"
                        value={discountVal}
                        onChange={e => setDiscountVal(e.target.value)}
                        style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 4 }}
                      />
                    </label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'grid', gap: 4 }}>
                      Minimum Order (₹)
                      <input
                        type="number"
                        min="0"
                        value={minOrderInr}
                        onChange={e => setMinOrderInr(e.target.value)}
                        style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 4 }}
                      />
                    </label>

                    <label style={{ fontSize: 12, fontWeight: 600, display: 'grid', gap: 4 }}>
                      Max Discount Cap (₹)
                      <input
                        type="number"
                        min="0"
                        value={maxDiscountInr}
                        onChange={e => setMaxDiscountInr(e.target.value)}
                        style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 4 }}
                      />
                    </label>
                  </div>

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                    <button
                      type="button"
                      onClick={() => setShowCouponModal(false)}
                      style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', fontSize: 12, fontWeight: 600 }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isCreatingCoupon}
                      className="amz-btn-cart"
                      style={{ width: 'auto', padding: '8px 20px', fontSize: 12 }}
                    >
                      {isCreatingCoupon ? 'Creating…' : 'Issue Coupon'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Audit Trail */}
      {activeTab === 'audit' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', textAlign: 'left', color: '#4b5563' }}>
                <th style={{ padding: '10px 16px' }}>Timestamp</th>
                <th style={{ padding: '10px 16px' }}>Action</th>
                <th style={{ padding: '10px 16px' }}>Resource</th>
                <th style={{ padding: '10px 16px' }}>Summary</th>
              </tr>
            </thead>
            <tbody>
              {auditData?.items.map((log, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 16px', color: '#6b7280' }}>{new Date(log.createdAt).toLocaleString()}</td>
                  <td style={{ padding: '10px 16px', fontWeight: 600 }}><code>{log.action}</code></td>
                  <td style={{ padding: '10px 16px', color: '#4b5563' }}>{log.resourceType}:{log.resourceId.slice(-6)}</td>
                  <td style={{ padding: '10px 16px', color: '#374151' }}>{log.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
