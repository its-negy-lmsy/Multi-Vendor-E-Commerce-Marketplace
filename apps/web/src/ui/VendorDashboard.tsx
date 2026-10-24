import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  DollarSign,
  Package,
  Plus,
  Trash2,
  Truck,
  Upload,
} from 'lucide-react';
import {
  useApplyVendorMutation,
  useCreateVendorProductMutation,
  useDeleteVendorProductMutation,
  useMeQuery,
  useUpdateFulfillmentMutation,
  useUploadImageMutation,
  useVendorLedgerQuery,
  useVendorOrdersQuery,
  useVendorProductsQuery,
  useVendorProfileQuery,
} from '../api';
import { formatPrice } from '../utils';

export const VendorDashboard: React.FC = () => {
  const { data: identity } = useMeQuery();
  const user = identity?.user;
  const isVendor = user?.role === 'VENDOR';

  const { data: profileData } = useVendorProfileQuery(undefined, { skip: !isVendor });
  const { data: productsData } = useVendorProductsQuery(undefined, { skip: !isVendor });
  const { data: ordersData } = useVendorOrdersQuery(undefined, { skip: !isVendor });
  const { data: ledgerData } = useVendorLedgerQuery(undefined, { skip: !isVendor });

  const [applyVendor, applyState] = useApplyVendorMutation();
  const [createProduct, createProductState] = useCreateVendorProductMutation();
  const [deleteProduct] = useDeleteVendorProductMutation();
  const [updateFulfillment] = useUpdateFulfillmentMutation();
  const [uploadImage] = useUploadImageMutation();

  const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'ledger'>('products');
  const [showAddModal, setShowAddModal] = useState(false);
  const [notice, setNotice] = useState('');

  // Add Product Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Home & Living');
  const [description, setDescription] = useState('');
  const [priceInr, setPriceInr] = useState('');
  const [stock, setStock] = useState('10');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  // Vendor Onboarding Form State
  const [shopName, setShopName] = useState('');
  const [shopDesc, setShopDesc] = useState('');

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await applyVendor({ shopName, description: shopDesc }).unwrap();
      setNotice('Vendor application submitted! Pending administrator review.');
    } catch (err: any) {
      setNotice(err?.data?.error?.message || 'Application submission failed.');
    }
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const res = await uploadImage({ dataUrl: base64, filename: file.name }).unwrap();
        // If local, prepend API host if relative
        const fullUrl = res.url.startsWith('http') ? res.url : `http://localhost:4000${res.url}`;
        setImageUrl(fullUrl);
        setNotice('Image uploaded to storage successfully.');
      } catch {
        setNotice('Image upload failed. You can paste an image URL directly.');
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const pricePaise = Math.round(parseFloat(priceInr) * 100);
      await createProduct({
        name,
        category,
        description,
        pricePaise,
        stock: parseInt(stock, 10),
        imageUrl: imageUrl || 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80',
      }).unwrap();
      setShowAddModal(false);
      setName('');
      setDescription('');
      setPriceInr('');
      setImageUrl('');
      setNotice('Product successfully published to marketplace catalog!');
    } catch (err: any) {
      setNotice(err?.data?.error?.message || 'Could not create product.');
    }
  };

  const handleFulfillItem = async (orderId: string, itemId: string, nextStatus: 'PACKED' | 'SHIPPED' | 'DELIVERED') => {
    try {
      await updateFulfillment({
        orderId,
        itemId,
        status: nextStatus,
        trackingNumber: nextStatus === 'SHIPPED' ? `TRK-${Date.now().toString().slice(-6)}` : undefined,
        courier: nextStatus === 'SHIPPED' ? 'BlueDart Express' : undefined,
      }).unwrap();
      setNotice(`Order item transitioned to ${nextStatus}.`);
    } catch (err: any) {
      setNotice(err?.data?.error?.message || 'Could not update item fulfillment.');
    }
  };

  if (!user) {
    return (
      <div style={{ maxWidth: 800, margin: '80px auto', textAlign: 'center', padding: 24 }}>
        <h2>Sign In Required</h2>
        <p style={{ color: '#6b7280', margin: '8px 0 20px' }}>Sign in to access the Maker Studio or apply as a partner.</p>
        <Link to="/" className="primary-button">Back to Storefront</Link>
      </div>
    );
  }

  // Not a vendor yet -> Show Onboarding Application
  if (!isVendor) {
    return (
      <div style={{ maxWidth: 700, margin: '40px auto 80px', padding: '0 20px' }}>
        <div className="eyebrow"><span className="eyebrow-line" /> MAKER ONBOARDING</div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, margin: '8px 0 16px' }}>
          Open Your Artisan Workshop
        </h1>
        <p style={{ color: '#4b5563', lineHeight: 1.7, marginBottom: 28 }}>
          Sell your handcrafted, sustainable, and considered objects to thousands of buyers. We provide automated split payments, transparent 10% platform commissions, and zero listing fees.
        </p>

        <form onSubmit={handleApply} style={{ background: '#fff', padding: 28, borderRadius: 8, border: '1px solid #e5e7eb', display: 'grid', gap: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, display: 'grid', gap: 6 }}>
            Workshop / Studio Name
            <input
              required
              value={shopName}
              onChange={e => setShopName(e.target.value)}
              placeholder="e.g. Terra Pottery Works"
              style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 4 }}
            />
          </label>

          <label style={{ fontSize: 13, fontWeight: 600, display: 'grid', gap: 6 }}>
            Artisan Story & Specialties
            <textarea
              required
              rows={4}
              value={shopDesc}
              onChange={e => setShopDesc(e.target.value)}
              placeholder="Describe what you make, materials used, and your studio location…"
              style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 4 }}
            />
          </label>

          {notice && <div style={{ fontSize: 13, color: '#16a34a' }}>{notice}</div>}

          <button type="submit" disabled={applyState.isLoading} className="primary-button" style={{ justifyContent: 'center' }}>
            Submit Maker Application
          </button>
        </form>
      </div>
    );
  }

  const profile = profileData?.profile;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '30px 20px 80px' }}>
      <div style={{ marginBottom: 20 }}>
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6b7280' }}>
          <ArrowLeft size={14} /> Back to Storefront
        </Link>
      </div>

      {/* Workshop Header */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 24, marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, margin: 0 }}>
              {profile?.shopName || 'Artisan Workshop'}
            </h1>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 4,
                background: profile?.status === 'APPROVED' ? '#dcfce7' : '#fef3c7',
                color: profile?.status === 'APPROVED' ? '#15803d' : '#b45309',
              }}
            >
              {profile?.status}
            </span>
          </div>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 13 }}>{profile?.description}</p>
        </div>

        <button
          className="primary-button"
          onClick={() => setShowAddModal(true)}
          style={{ padding: '10px 18px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Plus size={16} /> Add New Product
        </button>
      </div>

      {notice && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '10px 16px', borderRadius: 6, fontSize: 13, marginBottom: 20 }}>
          {notice}
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: 24 }}>
        {[
          { key: 'products', label: `My Products (${productsData?.items?.length || 0})`, icon: Package },
          { key: 'orders', label: `Orders to Fulfill (${ordersData?.items?.length || 0})`, icon: Truck },
          { key: 'ledger', label: `Earnings & Ledger (₹${((ledgerData?.payablePaise || 0) / 100).toFixed(0)})`, icon: DollarSign },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: '12px 20px',
              border: 0,
              background: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #50684d' : '2px solid transparent',
              color: activeTab === tab.key ? '#50684d' : '#6b7280',
              fontWeight: activeTab === tab.key ? 700 : 500,
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Products */}
      {activeTab === 'products' && (
        <div>
          {(!productsData?.items || productsData.items.length === 0) ? (
            <div style={{ background: '#f9fafb', padding: 40, borderRadius: 8, textAlign: 'center' }}>
              <Package size={32} color="#9ca3af" style={{ margin: '0 auto 10px' }} />
              <h3>No products in your catalog</h3>
              <p style={{ color: '#6b7280', fontSize: 13, margin: '4px 0 16px' }}>Publish your first handcrafted piece to start receiving orders.</p>
              <button className="primary-button" onClick={() => setShowAddModal(true)}>+ Create First Product</button>
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', textAlign: 'left', color: '#4b5563' }}>
                    <th style={{ padding: '12px 16px' }}>Item</th>
                    <th style={{ padding: '12px 16px' }}>Category</th>
                    <th style={{ padding: '12px 16px' }}>Price</th>
                    <th style={{ padding: '12px 16px' }}>Stock</th>
                    <th style={{ padding: '12px 16px' }}>Status</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {productsData.items.map(prod => (
                    <tr key={prod._id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <img src={prod.imageUrl} alt="" style={{ width: 44, height: 48, objectFit: 'cover', borderRadius: 4, background: '#f3f4f6' }} />
                        <div>
                          <strong style={{ color: '#111827' }}>{prod.name}</strong>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>{prod.ratingAverage} ★ ({prod.ratingCount} reviews)</div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', color: '#6b7280' }}>{prod.category}</td>
                      <td style={{ padding: '14px 16px', fontWeight: 600, color: '#111827' }}>{formatPrice(prod.pricePaise)}</td>
                      <td style={{ padding: '14px 16px', color: prod.stock > 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>{prod.stock}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: '#e0f2fe', color: '#0369a1' }}>
                          {prod.status}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => deleteProduct(prod._id)}
                          style={{ background: 'none', border: 0, color: '#dc2626', cursor: 'pointer', padding: 4 }}
                          title="Delete Product"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Orders to Fulfill */}
      {activeTab === 'orders' && (
        <div style={{ display: 'grid', gap: 20 }}>
          {(!ordersData?.items || ordersData.items.length === 0) ? (
            <div style={{ background: '#f9fafb', padding: 40, borderRadius: 8, textAlign: 'center' }}>
              <Truck size={32} color="#9ca3af" style={{ margin: '0 auto 10px' }} />
              <h3>No customer orders yet</h3>
              <p style={{ color: '#6b7280', fontSize: 13 }}>Orders containing items from your workshop will appear here for fulfillment.</p>
            </div>
          ) : (
            ordersData.items.map(order => (
              <div key={order._id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid #f3f4f6', paddingBottom: 10 }}>
                  <div>
                    <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase' }}>Order ID:</span>{' '}
                    <strong>#{order._id.slice(-8).toUpperCase()}</strong>
                    <span style={{ margin: '0 8px', color: '#d1d5db' }}>·</span>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>{new Date(order.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                    Workshop Sales: {formatPrice(order.totalPaise)}
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 12 }}>
                  {order.items.map(item => (
                    <div key={item._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafaf9', padding: '12px 16px', borderRadius: 6 }}>
                      <div>
                        <strong style={{ fontSize: 14, color: '#111827' }}>{item.quantity} × {item.name}</strong>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                          Unit Price: {formatPrice(item.unitPricePaise)} · Net Payable: <strong>{formatPrice(item.vendorPayablePaise)}</strong> (Platform Comm: {formatPrice(item.commissionPaise)})
                        </div>
                        <div style={{ fontSize: 11, color: '#50684d', fontWeight: 600, marginTop: 4 }}>
                          Fulfillment: {item.fulfillmentStatus}
                        </div>
                      </div>

                      {/* Transition Buttons */}
                      <div style={{ display: 'flex', gap: 8 }}>
                        {item.fulfillmentStatus === 'UNFULFILLED' && (
                          <button
                            className="primary-button"
                            onClick={() => handleFulfillItem(order._id, item._id, 'PACKED')}
                            style={{ padding: '6px 12px', fontSize: 11 }}
                          >
                            Mark as Packed
                          </button>
                        )}
                        {item.fulfillmentStatus === 'PACKED' && (
                          <button
                            className="primary-button"
                            onClick={() => handleFulfillItem(order._id, item._id, 'SHIPPED')}
                            style={{ padding: '6px 12px', fontSize: 11 }}
                          >
                            Mark as Shipped
                          </button>
                        )}
                        {item.fulfillmentStatus === 'SHIPPED' && (
                          <button
                            className="primary-button"
                            onClick={() => handleFulfillItem(order._id, item._id, 'DELIVERED')}
                            style={{ padding: '6px 12px', fontSize: 11, background: '#16a34a' }}
                          >
                            Mark as Delivered
                          </button>
                        )}
                        {item.fulfillmentStatus === 'DELIVERED' && (
                          <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>✓ Delivered</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Earnings & Ledger */}
      {activeTab === 'ledger' && (
        <div>
          <div style={{ background: '#f0f5ee', border: '1px solid #c7d9c2', borderRadius: 8, padding: 24, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#385536', textTransform: 'uppercase' }}>Total Payable Balance</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#1f331e', margin: '4px 0' }}>
                {formatPrice(ledgerData?.payablePaise || 0)}
              </div>
              <div style={{ fontSize: 12, color: '#587355' }}>Status: {ledgerData?.settlementStatus}</div>
            </div>
            <div style={{ fontSize: 12, color: '#4b5563', maxWidth: 300, textAlign: 'right' }}>
              Vendor payouts are recorded in immutable ledger entries upon captured customer checkouts.
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', textAlign: 'left', color: '#4b5563' }}>
                  <th style={{ padding: '12px 16px' }}>Date</th>
                  <th style={{ padding: '12px 16px' }}>Order ID</th>
                  <th style={{ padding: '12px 16px' }}>Type</th>
                  <th style={{ padding: '12px 16px' }}>Net Amount</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {(!ledgerData?.entries || ledgerData.entries.length === 0) ? (
                  <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>No ledger transactions recorded yet.</td></tr>
                ) : (
                  ledgerData.entries.map(entry => (
                    <tr key={entry._id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '12px 16px', color: '#6b7280' }}>{new Date(entry.createdAt).toLocaleDateString()}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>#{entry.orderId.slice(-8).toUpperCase()}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: entry.type === 'SALE_CREDIT' ? '#16a34a' : '#dc2626' }}>
                          {entry.type}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#111827' }}>{formatPrice(entry.amountPaise)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: '#e0f2fe', color: '#0369a1' }}>
                          {entry.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <section
            className="auth-modal"
            role="dialog"
            onClick={e => e.stopPropagation()}
            style={{ width: 'min(100%, 540px)', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="eyebrow"><span className="eyebrow-line" /> ARTISAN STUDIO</div>
            <h2 style={{ fontSize: 24, margin: '6px 0 16px' }}>Publish New Artisan Product</h2>

            <form onSubmit={handleCreateProduct} style={{ display: 'grid', gap: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'grid', gap: 4 }}>
                Product Name
                <input
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Hand-Thrown Stoneware Teapot"
                  style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'grid', gap: 4 }}>
                  Category
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff' }}
                  >
                    <option value="Home & Living">Home & Living</option>
                    <option value="Accessories & Wear">Accessories & Wear</option>
                    <option value="Apothecary & Wellness">Apothecary & Wellness</option>
                    <option value="Stationery & Paper">Stationery & Paper</option>
                  </select>
                </label>

                <label style={{ fontSize: 12, fontWeight: 600, display: 'grid', gap: 4 }}>
                  Price (in ₹)
                  <input
                    required
                    type="number"
                    min="1"
                    step="0.01"
                    value={priceInr}
                    onChange={e => setPriceInr(e.target.value)}
                    placeholder="e.g. 2499"
                    style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 4 }}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'grid', gap: 4 }}>
                  Initial Stock Inventory
                  <input
                    required
                    type="number"
                    min="1"
                    value={stock}
                    onChange={e => setStock(e.target.value)}
                    style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 4 }}
                  />
                </label>
              </div>

              {/* S3 / Local Media Upload Picker */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Product Photo (Upload to Storage)
                </label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <label
                    style={{
                      border: '1px dashed #50684d',
                      background: '#f8faf7',
                      borderRadius: 6,
                      padding: '8px 14px',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#50684d',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Upload size={14} />
                    {uploading ? 'Uploading…' : 'Choose Local File'}
                    <input type="file" accept="image/*" onChange={handleImageFileChange} style={{ display: 'none' }} />
                  </label>
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>or paste image URL below:</span>
                </div>
                <input
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  style={{ width: '100%', marginTop: 6, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }}
                />
                {imageUrl && (
                  <div style={{ marginTop: 8 }}>
                    <img src={imageUrl} alt="Preview" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4 }} />
                  </div>
                )}
              </div>

              <label style={{ fontSize: 12, fontWeight: 600, display: 'grid', gap: 4 }}>
                Product Description
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Detail the materials, design intention, dimensions, and craft technique…"
                  style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </label>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button
                  type="submit"
                  disabled={createProductState.isLoading}
                  className="primary-button"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Publish to Catalog
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ border: '1px solid #d1d5db', background: 'none', padding: '0 16px', borderRadius: 4 }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
};
