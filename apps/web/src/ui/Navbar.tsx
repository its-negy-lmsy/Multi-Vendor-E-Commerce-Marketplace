import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  Heart,
  LogOut,
  MapPin,
  Menu,
  Package,
  Search,
  Shield,
  ShoppingCart,
  Store,
  X,
  Zap,
} from 'lucide-react';
import { useLoginMutation, useLogoutMutation, useMeQuery, useProductsQuery } from '../api';

interface NavbarProps {
  cartCount: number;
  deliveryPincode?: string;
  onOpenCart: () => void;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onOpenPinModal?: () => void;
  onSearch?: (query: string, category: string) => void;
  onOpenWishlist?: () => void;
  wishlistCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  cartCount,
  deliveryPincode = '110001',
  onOpenCart,
  onOpenAuth,
  onOpenPinModal,
  onSearch,
  onOpenWishlist,
  wishlistCount = 0,
}) => {
  const { data: identity } = useMeQuery();
  const [logout] = useLogoutMutation();
  const [login] = useLoginMutation();
  const navigate = useNavigate();
  const user = identity?.user;

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [showSuggest, setShowSuggest] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  // Live products for auto-suggest
  const { data: searchResults } = useProductsQuery(
    { q: searchTerm, ...(selectedCat ? { category: selectedCat } : {}), limit: 5 },
    { skip: searchTerm.trim().length < 2 }
  );

  const suggestedProducts = searchResults?.items ?? [];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggest(false);
      }
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggest(false);
    if (onSearch) {
      onSearch(searchTerm, selectedCat);
    }
    navigate(`/?q=${encodeURIComponent(searchTerm)}${selectedCat ? `&cat=${encodeURIComponent(selectedCat)}` : ''}`);
  };

  const handleSelectSuggestion = (id: string) => {
    setShowSuggest(false);
    navigate(`/product/${id}`);
  };

  const handleLogout = async () => {
    await logout().unwrap();
    setAccountMenuOpen(false);
    navigate('/');
  };

  // Instant Demo Switcher for fast evaluation
  const handleQuickSwitch = async (role: 'CUSTOMER' | 'VENDOR' | 'ADMIN') => {
    let email = 'customer@fs01.local';
    let password = 'CustomerDemo!2026';
    if (role === 'VENDOR') {
      email = 'maker@fs01.local';
      password = 'MakerDemo!2026';
    } else if (role === 'ADMIN') {
      email = 'admin@fs01.local';
      password = 'AdminDemo!2026';
    }

    try {
      await login({ email, password }).unwrap();
      if (role === 'VENDOR') navigate('/vendor/dashboard');
      else if (role === 'ADMIN') navigate('/admin/dashboard');
      else navigate('/');
    } catch (err) {
      console.error('Quick switch failed', err);
    }
  };

  return (
    <>
      {/* 1. Main Amazon Top Header */}
      <header className="amz-header-top">
        {/* Amazon Marketplace Logo */}
        <Link to="/" className="amz-logo-box" aria-label="Amazon Marketplace Home">
          <div className="amz-logo-text">
            amazon<span>artisan</span>
            <b className="amz-logo-dot">.in</b>
          </div>
        </Link>

        {/* Deliver to Pin location selector */}
        <button
          className="amz-location-btn"
          onClick={onOpenPinModal}
          title="Click to change delivery pincode"
        >
          <MapPin size={18} style={{ color: '#febd69', flexShrink: 0 }} />
          <div>
            <div className="amz-location-sub">
              Deliver to {user ? user.name.split(' ')[0] : 'Guest'}
            </div>
            <div className="amz-location-main">New Delhi {deliveryPincode}</div>
          </div>
        </button>

        {/* Omnisearch Bar with Category & Auto-Suggest */}
        <div ref={searchContainerRef} style={{ flex: 1, position: 'relative' }}>
          <form className="amz-search-form" onSubmit={handleSearchSubmit}>
            <select
              className="amz-search-cat"
              value={selectedCat}
              onChange={e => setSelectedCat(e.target.value)}
              aria-label="Select Category"
            >
              <option value="">All Categories</option>
              <option value="Home & Living">Home & Living</option>
              <option value="Accessories & Wear">Accessories & Wear</option>
              <option value="Apothecary & Wellness">Apothecary & Wellness</option>
              <option value="Stationery & Paper">Stationery & Paper</option>
            </select>

            <input
              type="text"
              className="amz-search-input"
              placeholder="Search Amazon Marketplace, pottery, bags, tea..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setShowSuggest(true);
              }}
              onFocus={() => setShowSuggest(true)}
            />

            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{ padding: '0 8px', color: '#888' }}
                aria-label="Clear Search"
              >
                <X size={15} />
              </button>
            )}

            <button type="submit" className="amz-search-submit" aria-label="Search Submit">
              <Search size={19} />
            </button>
          </form>

          {/* Live Auto-Suggest Popup */}
          {showSuggest && searchTerm.trim().length >= 2 && (
            <div className="amz-suggest-dropdown">
              <div style={{ padding: '6px 12px', fontSize: 11, fontWeight: 700, color: '#6b7280', background: '#f9fafb' }}>
                MATCHING ARTISAN PIECES
              </div>
              {suggestedProducts.length === 0 ? (
                <div style={{ padding: '12px', fontSize: 13, color: '#6b7280' }}>
                  No exact matches found for "{searchTerm}". Press Enter to view full results.
                </div>
              ) : (
                suggestedProducts.map(item => (
                  <div
                    key={item._id}
                    className="amz-suggest-item"
                    onClick={() => handleSelectSuggestion(item._id)}
                  >
                    <img src={item.imageUrl} alt={item.name} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>
                        {item.category} · ★ {item.ratingAverage.toFixed(1)}
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#b12704' }}>
                      ₹{(item.pricePaise / 100).toLocaleString('en-IN')}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Language / Region */}
        <div className="amz-nav-item" style={{ cursor: 'default' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, fontSize: 13 }}>
            <span>🇮🇳</span> EN
          </div>
        </div>

        {/* Account & Lists Dropdown */}
        <div ref={accountRef} style={{ position: 'relative' }}>
          <div
            className="amz-nav-item"
            style={{ cursor: 'pointer' }}
            onClick={() => setAccountMenuOpen(!accountMenuOpen)}
          >
            <span className="amz-nav-line1">
              Hello, {user ? user.name.split(' ')[0] : 'sign in'}
            </span>
            <span className="amz-nav-line2" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              Account & Lists <ChevronDown size={12} />
            </span>
          </div>

          {accountMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: 48,
                right: 0,
                width: 260,
                background: '#ffffff',
                border: '1px solid #d5d9d9',
                borderRadius: 4,
                boxShadow: '0 6px 18px rgba(0,0,0,0.2)',
                zIndex: 300,
                padding: '16px',
                color: '#111111',
              }}
            >
              {!user ? (
                <div style={{ textAlign: 'center', paddingBottom: 14, borderBottom: '1px solid #e5e7eb' }}>
                  <button
                    className="amz-btn-cart"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      onOpenAuth('login');
                    }}
                    style={{ marginBottom: 8 }}
                  >
                    Sign in
                  </button>
                  <div style={{ fontSize: 11, color: '#565959' }}>
                    New customer?{' '}
                    <span
                      style={{ color: '#007185', cursor: 'pointer', fontWeight: 600 }}
                      onClick={() => {
                        setAccountMenuOpen(false);
                        onOpenAuth('register');
                      }}
                    >
                      Start here.
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{ paddingBottom: 12, borderBottom: '1px solid #e5e7eb', marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{user.name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    {user.email} · <strong>{user.role}</strong>
                  </div>
                </div>
              )}

              <div style={{ fontSize: 12, fontWeight: 700, color: '#0f1111', marginBottom: 8 }}>
                Your Marketplace Links
              </div>
              <ul style={{ listStyle: 'none', display: 'grid', gap: 6, fontSize: 13 }}>
                <li>
                  <Link
                    to="/orders"
                    style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#374151' }}
                    onClick={() => setAccountMenuOpen(false)}
                  >
                    <Package size={15} /> Your Orders & Tracking
                  </Link>
                </li>
                {onOpenWishlist && (
                  <li>
                    <button
                      style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#374151', fontSize: 13 }}
                      onClick={() => {
                        setAccountMenuOpen(false);
                        onOpenWishlist();
                      }}
                    >
                      <Heart size={15} /> Your Wish List ({wishlistCount})
                    </button>
                  </li>
                )}
                <li>
                  <Link
                    to="/vendor/dashboard"
                    style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#374151' }}
                    onClick={() => setAccountMenuOpen(false)}
                  >
                    <Store size={15} /> Vendor Studio (Seller Central)
                  </Link>
                </li>
                {user?.role === 'ADMIN' && (
                  <li>
                    <Link
                      to="/admin/dashboard"
                      style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#99583d', fontWeight: 600 }}
                      onClick={() => setAccountMenuOpen(false)}
                    >
                      <Shield size={15} /> Admin Command Center
                    </Link>
                  </li>
                )}
              </ul>

              {user && (
                <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 12, paddingTop: 10 }}>
                  <button
                    onClick={handleLogout}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 13,
                      color: '#b12704',
                      fontWeight: 600,
                      width: '100%',
                    }}
                  >
                    <LogOut size={15} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Returns & Orders Direct Link */}
        <Link to="/orders" className="amz-nav-item">
          <span className="amz-nav-line1">Returns</span>
          <span className="amz-nav-line2">& Orders</span>
        </Link>

        {/* Amazon Shopping Cart */}
        <button className="amz-cart-btn" onClick={onOpenCart} aria-label="Open Shopping Cart">
          <ShoppingCart size={28} />
          <span className="amz-cart-count-badge">{cartCount}</span>
          <span className="amz-cart-label">Cart</span>
        </button>
      </header>

      {/* 2. Amazon Sub-Navigation Bar */}
      <nav className="amz-subnav">
        <div className="amz-subnav-links">
          <Link to="/" className="amz-subnav-link">
            <Menu size={16} /> All
          </Link>
          <a href="#shop" className="amz-subnav-link">
            Today's Deals
          </a>
          <a href="#shop" className="amz-subnav-link">
            Best Sellers
          </a>
          <Link to="/vendor/dashboard" className="amz-subnav-link">
            <Store size={14} /> Sell on Marketplace
          </Link>
          <Link to="/orders" className="amz-subnav-link">
            <Package size={14} /> Track Orders
          </Link>
          {user?.role === 'ADMIN' && (
            <Link to="/admin/dashboard" className="amz-subnav-link" style={{ color: '#febd69', fontWeight: 700 }}>
              <Shield size={14} /> Admin Command
            </Link>
          )}
        </div>

        {/* Instant Role Switcher for Evaluation */}
        <div className="amz-demo-switcher">
          <span className="amz-demo-label">
            <Zap size={12} /> Test Switcher:
          </span>
          <button
            className={`amz-demo-pill ${user?.role === 'CUSTOMER' ? 'active' : ''}`}
            onClick={() => handleQuickSwitch('CUSTOMER')}
            title="Log in as Customer (Yuvraj Negy)"
          >
            👤 Customer
          </button>
          <button
            className={`amz-demo-pill ${user?.role === 'VENDOR' ? 'active' : ''}`}
            onClick={() => handleQuickSwitch('VENDOR')}
            title="Log in as Artisan Maker (Julian Vance - Studio North)"
          >
            🏬 Maker
          </button>
          <button
            className={`amz-demo-pill ${user?.role === 'ADMIN' ? 'active' : ''}`}
            onClick={() => handleQuickSwitch('ADMIN')}
            title="Log in as Admin Platform Operator"
          >
            🛡️ Admin
          </button>
        </div>
      </nav>
    </>
  );
};
