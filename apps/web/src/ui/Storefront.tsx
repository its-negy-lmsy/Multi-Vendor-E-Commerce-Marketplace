import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Heart,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
  Truck,
  Zap,
} from 'lucide-react';
import { useCartQuery, useMeQuery, useProductsQuery, useUpdateCartMutation } from '../api';
import { formatPrice } from '../utils';

interface StorefrontProps {
  onOpenCart: () => void;
  onOpenAuth: () => void;
  onShowNotice: (msg: string) => void;
  onToggleWishlist?: (productId: string) => void;
  wishlistIds?: string[];
  deliveryPincode?: string;
}

export const Storefront: React.FC<StorefrontProps> = ({
  onOpenCart,
  onOpenAuth,
  onShowNotice,
  onToggleWishlist,
  wishlistIds = [],
  deliveryPincode = '110001',
}) => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Search & Filter state
  const queryParam = searchParams.get('q') || '';
  const categoryParam = searchParams.get('cat') || '';

  const [search, setSearch] = useState(queryParam);
  const [category, setCategory] = useState(categoryParam);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [priceTier, setPriceTier] = useState<string>('');
  const [customMin, setCustomMin] = useState('');
  const [customMax, setCustomMax] = useState('');
  const [appliedMinPrice, setAppliedMinPrice] = useState<number | undefined>(undefined);
  const [appliedMaxPrice, setAppliedMaxPrice] = useState<number | undefined>(undefined);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState('relevance');

  // Carousel slide state
  const [currentSlide, setCurrentSlide] = useState(0);

  // Sync with URL params
  useEffect(() => {
    if (queryParam !== search) setSearch(queryParam);
    if (categoryParam !== category) setCategory(categoryParam);
  }, [queryParam, categoryParam]);

  const { data: identity } = useMeQuery();
  const isCustomer = identity?.user?.role === 'CUSTOMER';
  const { data: cartData } = useCartQuery(undefined, { skip: !isCustomer });
  const [updateCart] = useUpdateCartMutation();

  const { data, isLoading, isError } = useProductsQuery({
    q: search,
    ...(category ? { category } : {}),
    ...(appliedMinPrice !== undefined ? { minPrice: appliedMinPrice } : {}),
    ...(appliedMaxPrice !== undefined ? { maxPrice: appliedMaxPrice } : {}),
    sort,
  });

  const rawProducts = data?.items ?? [];

  // Client-side filtering for rating and stock
  const products = rawProducts.filter(p => {
    if (minRating !== null && p.ratingAverage < minRating) return false;
    if (inStockOnly && p.stock <= 0) return false;
    return true;
  });

  // Carousel timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % 4);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const handlePriceTierSelect = (tier: string) => {
    setPriceTier(tier);
    if (tier === 'under1000') {
      setAppliedMinPrice(undefined);
      setAppliedMaxPrice(100000);
    } else if (tier === '1000to2500') {
      setAppliedMinPrice(100000);
      setAppliedMaxPrice(250000);
    } else if (tier === '2500to5000') {
      setAppliedMinPrice(250000);
      setAppliedMaxPrice(500000);
    } else if (tier === 'over5000') {
      setAppliedMinPrice(500000);
      setAppliedMaxPrice(undefined);
    } else {
      setAppliedMinPrice(undefined);
      setAppliedMaxPrice(undefined);
    }
  };

  const handleApplyCustomPrice = (e: React.FormEvent) => {
    e.preventDefault();
    const minVal = customMin ? parseInt(customMin, 10) * 100 : undefined;
    const maxVal = customMax ? parseInt(customMax, 10) * 100 : undefined;
    setAppliedMinPrice(minVal);
    setAppliedMaxPrice(maxVal);
    setPriceTier('custom');
  };

  const handleClearFilters = () => {
    setSearch('');
    setCategory('');
    setMinRating(null);
    setPriceTier('');
    setCustomMin('');
    setCustomMax('');
    setAppliedMinPrice(undefined);
    setAppliedMaxPrice(undefined);
    setInStockOnly(false);
    setSearchParams({});
  };

  const handleQuickAdd = async (e: React.MouseEvent, productId: string, productName: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isCustomer) {
      onOpenAuth();
      return;
    }
    const items = (cartData?.items ?? []).map(i => ({ productId: i.product._id, quantity: i.quantity }));
    const match = items.find(i => i.productId === productId);
    if (match) {
      match.quantity = Math.min(20, match.quantity + 1);
    } else {
      items.push({ productId, quantity: 1 });
    }
    try {
      await updateCart({ items }).unwrap();
      onShowNotice(`Added "${productName}" to your Cart.`);
      onOpenCart();
    } catch {
      onShowNotice('Could not add to cart. Check available stock.');
    }
  };

  const handleBuyNow = async (e: React.MouseEvent, productId: string, productName: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isCustomer) {
      onOpenAuth();
      return;
    }
    const items = (cartData?.items ?? []).map(i => ({ productId: i.product._id, quantity: i.quantity }));
    const match = items.find(i => i.productId === productId);
    if (match) {
      match.quantity = Math.min(20, match.quantity + 1);
    } else {
      items.push({ productId, quantity: 1 });
    }
    try {
      await updateCart({ items }).unwrap();
      onShowNotice(`Proceeding to checkout with "${productName}"...`);
      onOpenCart();
    } catch {
      onShowNotice('Could not initiate checkout. Check stock.');
    }
  };

  // Carousel Slides
  const slides = [
    {
      tag: 'GREAT ARTISAN FESTIVAL · LIVE NOW',
      title: 'Handcrafted With Soul. Delivered With Pride.',
      desc: 'Discover authentic, small-batch treasures directly from verified Indian artisan studios. Free express delivery, zero middlemen markup, and guaranteed fair-trade commissions.',
      bg: 'linear-gradient(rgba(36, 43, 35, 0.72), rgba(36, 43, 35, 0.85)), url(https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=1600&q=80)',
      btnText: 'Shop Festival Deals',
      link: '#shop',
    },
    {
      tag: 'MASTER CERAMICS & HOME DECOR',
      title: 'Architectural Ceramics & Tableware',
      desc: 'Wheel-thrown stoneware pour-overs, matte raw terracotta vessels, and spun brass accent lamps designed to age gracefully in your home.',
      bg: 'linear-gradient(rgba(36, 43, 35, 0.72), rgba(36, 43, 35, 0.85)), url(https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=1600&q=80)',
      btnText: 'Explore Ceramics',
      link: '#shop',
    },
    {
      tag: 'EXPEDITION CARRY & HERITAGE LEATHER',
      title: 'Built For A Lifetime Of Journeys',
      desc: 'Paraffin waxed 18oz duck canvas, full-grain Italian Buttero card wallets, and skeletonized titanium EDC essentials.',
      bg: 'linear-gradient(rgba(36, 43, 35, 0.72), rgba(36, 43, 35, 0.85)), url(https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=1600&q=80)',
      btnText: 'View Leather & Bags',
      link: '#shop',
    },
    {
      tag: 'ORGANIC WELLNESS & BOTANICALS',
      title: 'Pure Himalayan Botanicals & Artisan Tea',
      desc: 'Cold-pressed wildcrafted hemp seed serums, hand-poured Mysore sandalwood candles, and estate Nilgiri lavender tea in keepsake tins.',
      bg: 'linear-gradient(rgba(36, 43, 35, 0.72), rgba(36, 43, 35, 0.85)), url(https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&w=1600&q=80)',
      btnText: 'Discover Apothecary',
      link: '#shop',
    },
  ];

  return (
    <div>
      {/* 1. Hero Promotional Carousel */}
      <section className="amz-hero-carousel">
        {slides.map((slide, idx) => (
          <div
            key={idx}
            className={`amz-slide ${idx === currentSlide ? 'active' : ''}`}
            style={{ backgroundImage: slide.bg }}
          >
            <div className="amz-slide-content">
              <span className="amz-slide-tag">{slide.tag}</span>
              <h1 className="amz-slide-title">{slide.title}</h1>
              <p className="amz-slide-desc">{slide.desc}</p>
              <a href={slide.link} className="amz-slide-btn">
                {slide.btnText} <ArrowRight size={16} />
              </a>
            </div>
          </div>
        ))}

        <button
          className="amz-carousel-arrow amz-arrow-prev"
          onClick={() => setCurrentSlide(prev => (prev === 0 ? 3 : prev - 1))}
          aria-label="Previous Slide"
        >
          <ChevronLeft size={32} />
        </button>
        <button
          className="amz-carousel-arrow amz-arrow-next"
          onClick={() => setCurrentSlide(prev => (prev + 1) % 4)}
          aria-label="Next Slide"
        >
          <ChevronRight size={32} />
        </button>
      </section>

      {/* 2. Amazon Homepage Quad Feature Cards (Floating over Hero) */}
      <section className="amz-quad-container">
        {/* Quad Card 1: Deal of the Day with Countdown */}
        <div className="amz-quad-card">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 className="amz-quad-title">Deal of the Day</h3>
              <span style={{ fontSize: 11, color: '#cc0c39', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={13} /> 04:32:18
              </span>
            </div>
            <div style={{ background: '#f8f8f8', borderRadius: 4, padding: 10, textAlign: 'center', marginBottom: 10 }}>
              <img
                src="https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&q=80"
                alt="Pour Over Dripper"
                style={{ width: '100%', height: 140, objectFit: 'contain' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span className="amz-deal-badge">28% off</span>
              <span style={{ color: '#aa775e', fontSize: 12, fontWeight: 700 }}>Limited Time Deal</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#0f1111', marginTop: 4 }}>
              ₹2,899 <span style={{ fontSize: 12, color: '#565959', textDecoration: 'line-through' }}>₹3,999</span>
            </div>
            <div style={{ fontSize: 12, color: '#0f1111', marginTop: 4 }}>
              Stoneware Spiral Pour-Over Dripper
            </div>
          </div>
          <Link to="/product/6ae60ce16b6f4c6f03bf38b1" className="amz-quad-link" style={{ marginTop: 12 }}>
            See all deals ↗
          </Link>
        </div>

        {/* Quad Card 2: Shop by Department */}
        <div className="amz-quad-card">
          <h3 className="amz-quad-title">Explore by Department</h3>
          <div className="amz-quad-grid">
            <div className="amz-quad-subitem" onClick={() => setCategory('Home & Living')}>
              <img src="https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=200&q=80" alt="Home Decor" />
              <span>Home & Living</span>
            </div>
            <div className="amz-quad-subitem" onClick={() => setCategory('Accessories & Wear')}>
              <img src="https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=200&q=80" alt="Leather" />
              <span>Leather & Carry</span>
            </div>
            <div className="amz-quad-subitem" onClick={() => setCategory('Apothecary & Wellness')}>
              <img src="https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=200&q=80" alt="Candles" />
              <span>Apothecary</span>
            </div>
            <div className="amz-quad-subitem" onClick={() => setCategory('Stationery & Paper')}>
              <img src="https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=200&q=80" alt="Journals" />
              <span>Paper & Crafts</span>
            </div>
          </div>
          <a href="#shop" className="amz-quad-link" onClick={() => setCategory('')}>
            View full catalog ↗
          </a>
        </div>

        {/* Quad Card 3: Artisan Partner Spotlight */}
        <div className="amz-quad-card">
          <div>
            <h3 className="amz-quad-title">Artisan Spotlight</h3>
            <div style={{ position: 'relative', borderRadius: 4, overflow: 'hidden', height: 160, marginBottom: 10 }}>
              <img
                src="https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=400&q=80"
                alt="Nomad Workshop"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '2px 8px', borderRadius: 2, fontSize: 11, fontWeight: 700 }}>
                NOMAD WORKSHOP · KANPUR
              </div>
            </div>
            <p style={{ fontSize: 12, color: '#565959', lineHeight: 1.4 }}>
              Specializing in 18oz paraffin waxed canvas expedition carry and hand saddle-stitched Buttero leather goods.
            </p>
          </div>
          <a href="#shop" className="amz-quad-link" onClick={() => setCategory('Accessories & Wear')}>
            Explore Nomad Workshop ↗
          </a>
        </div>

        {/* Quad Card 4: Sell on Marketplace */}
        <div className="amz-quad-card" style={{ background: 'linear-gradient(135deg, #ffffff, #fdf8f0)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#b77b57', marginBottom: 4 }}>
              <Store size={18} />
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Seller Central</span>
            </div>
            <h3 className="amz-quad-title" style={{ marginTop: 2 }}>Join 120+ Independent Makers</h3>
            <p style={{ fontSize: 12, color: '#565959', lineHeight: 1.5, margin: '8px 0 16px' }}>
              Sell your handcrafted pieces to millions of conscious buyers across India with automated split settlements, verified reviews, and just 10% platform fee.
            </p>
            <ul style={{ listStyle: 'none', display: 'grid', gap: 6, fontSize: 12, color: '#374151', marginBottom: 16 }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Check size={14} color="#455d46" /> Direct Razorpay Route escrow</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Check size={14} color="#455d46" /> Automated GST tax invoices</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Check size={14} color="#455d46" /> Vendor fulfillment dashboard</li>
            </ul>
          </div>
          <Link to="/vendor/dashboard" className="amz-btn-cart" style={{ textDecoration: 'none', textAlign: 'center' }}>
            Start Selling Today ↗
          </Link>
        </div>
      </section>

      {/* 3. Amazon Trust & A-to-Z Guarantee Ribbon */}
      <div className="amz-trust-ribbon">
        <div className="amz-trust-inner">
          <div className="amz-trust-item">
            <div className="amz-trust-icon"><Truck size={20} /></div>
            <div>
              <div className="amz-trust-bold">Free Express Delivery</div>
              <div className="amz-trust-sub">On orders above ₹500 across 19,000+ PIN codes</div>
            </div>
          </div>
          <div className="amz-trust-item">
            <div className="amz-trust-icon"><ShieldCheck size={20} /></div>
            <div>
              <div className="amz-trust-bold">100% Verified Artisans</div>
              <div className="amz-trust-sub">Direct studio provenance & genuine slow craft</div>
            </div>
          </div>
          <div className="amz-trust-item">
            <div className="amz-trust-icon"><Zap size={20} /></div>
            <div>
              <div className="amz-trust-bold">Automated Split Payouts</div>
              <div className="amz-trust-sub">Escrow routed payments directly to maker accounts</div>
            </div>
          </div>
          <div className="amz-trust-item">
            <div className="amz-trust-icon"><RotateCcw size={20} /></div>
            <div>
              <div className="amz-trust-bold">7-Day Replacement Guarantee</div>
              <div className="amz-trust-sub">Hassle-free support with verified tax invoices</div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Two-Column Amazon Discovery Layout */}
      <section className="amz-shop-layout" id="shop">
        {/* Left Filter Sidebar */}
        <aside className="amz-sidebar">
          {/* Department Filter */}
          <div className="amz-filter-group">
            <h4 className="amz-filter-heading">Department</h4>
            <ul className="amz-filter-list">
              <li
                className={`amz-filter-item ${!category ? 'active' : ''}`}
                onClick={() => setCategory('')}
              >
                <span>All Departments</span>
              </li>
              {[
                { name: 'Home & Living', count: 4 },
                { name: 'Accessories & Wear', count: 4 },
                { name: 'Apothecary & Wellness', count: 3 },
                { name: 'Stationery & Paper', count: 1 },
              ].map(cat => (
                <li
                  key={cat.name}
                  className={`amz-filter-item ${category === cat.name ? 'active' : ''}`}
                  onClick={() => setCategory(cat.name)}
                >
                  <span>{cat.name}</span>
                  <span className="amz-filter-count">({cat.count})</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Customer Reviews Rating Filter */}
          <div className="amz-filter-group">
            <h4 className="amz-filter-heading">Customer Reviews</h4>
            <ul className="amz-filter-list">
              {[4, 3, 2].map(stars => (
                <li
                  key={stars}
                  className={`amz-filter-item ${minRating === stars ? 'active' : ''}`}
                  onClick={() => setMinRating(minRating === stars ? null : stars)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ display: 'flex', color: '#de7921' }}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={13}
                          fill={i < stars ? 'currentColor' : 'none'}
                          stroke="currentColor"
                        />
                      ))}
                    </div>
                    <span>& Up</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Price Range Filter */}
          <div className="amz-filter-group">
            <h4 className="amz-filter-heading">Price (₹)</h4>
            <ul className="amz-filter-list">
              {[
                { label: 'Under ₹1,000', id: 'under1000' },
                { label: '₹1,000 - ₹2,500', id: '1000to2500' },
                { label: '₹2,500 - ₹5,000', id: '2500to5000' },
                { label: 'Over ₹5,000', id: 'over5000' },
              ].map(tier => (
                <li
                  key={tier.id}
                  className={`amz-filter-item ${priceTier === tier.id ? 'active' : ''}`}
                  onClick={() => handlePriceTierSelect(priceTier === tier.id ? '' : tier.id)}
                >
                  <span>{tier.label}</span>
                </li>
              ))}
            </ul>

            {/* Custom Min / Max Price Inputs */}
            <form onSubmit={handleApplyCustomPrice} className="amz-price-inputs">
              <input
                type="number"
                placeholder="₹ Min"
                className="amz-price-input"
                value={customMin}
                onChange={e => setCustomMin(e.target.value)}
              />
              <span style={{ color: '#767676' }}>-</span>
              <input
                type="number"
                placeholder="₹ Max"
                className="amz-price-input"
                value={customMax}
                onChange={e => setCustomMax(e.target.value)}
              />
              <button type="submit" className="amz-price-go">Go</button>
            </form>
          </div>

          {/* Availability Checkbox */}
          <div className="amz-filter-group">
            <h4 className="amz-filter-heading">Availability</h4>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={e => setInStockOnly(e.target.checked)}
              />
              <span>In Stock Only</span>
            </label>
          </div>

          {/* Clear Filters Button */}
          {(category || search || minRating || priceTier || inStockOnly) && (
            <button
              onClick={handleClearFilters}
              style={{
                width: '100%',
                marginTop: 10,
                padding: '6px 12px',
                border: '1px solid #d5d9d9',
                borderRadius: 4,
                background: '#f7fafa',
                fontSize: 12,
                fontWeight: 600,
                color: '#0f1111',
              }}
            >
              Clear All Filters
            </button>
          )}
        </aside>

        {/* Right Main Product Results Area */}
        <main className="amz-results-area">
          {/* Results Bar */}
          <div className="amz-results-bar">
            <div className="amz-results-count">
              Showing <b>{products.length}</b> of <b>{rawProducts.length}</b> results
              {search && <span> for "<b>{search}</b>"</span>}
              {category && <span> in <b>{category}</b></span>}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label htmlFor="amz-sort" style={{ fontSize: 12, color: '#565959' }}>Sort by:</label>
              <select
                id="amz-sort"
                className="amz-sort-select"
                value={sort}
                onChange={e => setSort(e.target.value)}
              >
                <option value="relevance">Featured</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="rating">Avg. Customer Review</option>
                <option value="newest">Newest Arrivals</option>
              </select>
            </div>
          </div>

          {/* Active Filter Chips */}
          {(category || search || minRating || priceTier || inStockOnly) && (
            <div className="amz-active-chips">
              {category && (
                <span className="amz-chip">
                  Department: {category} <button onClick={() => setCategory('')}>×</button>
                </span>
              )}
              {search && (
                <span className="amz-chip">
                  Keyword: "{search}" <button onClick={() => setSearch('')}>×</button>
                </span>
              )}
              {minRating && (
                <span className="amz-chip">
                  Rating: {minRating}★ & Up <button onClick={() => setMinRating(null)}>×</button>
                </span>
              )}
              {priceTier && (
                <span className="amz-chip">
                  Price Filter <button onClick={() => handlePriceTierSelect('')}>×</button>
                </span>
              )}
              {inStockOnly && (
                <span className="amz-chip">
                  In Stock Only <button onClick={() => setInStockOnly(false)}>×</button>
                </span>
              )}
              <span className="amz-chip-clear" onClick={handleClearFilters}>
                Clear all
              </span>
            </div>
          )}

          {/* Loading & Empty States */}
          {isLoading && (
            <div style={{ padding: '60px 20px', textAlign: 'center', background: '#ffffff', borderRadius: 6 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#565959' }}>Loading verified artisan products…</div>
            </div>
          )}

          {isError && (
            <div style={{ padding: '40px 20px', textAlign: 'center', background: '#ffffff', borderRadius: 6 }}>
              <h3>Failed to reach catalog service</h3>
              <p style={{ color: '#565959', margin: '8px 0' }}>Please verify the backend API server is running on port 4000.</p>
            </div>
          )}

          {!isLoading && !isError && products.length === 0 && (
            <div style={{ padding: '60px 20px', textAlign: 'center', background: '#ffffff', borderRadius: 6 }}>
              <h3 style={{ fontSize: 18, color: '#0f1111', marginBottom: 8 }}>No results matching your filters</h3>
              <p style={{ color: '#565959', marginBottom: 16 }}>Try resetting price limits or searching for broader terms like "pottery", "bag", or "tea".</p>
              <button className="amz-btn-cart" onClick={handleClearFilters} style={{ width: 'auto', padding: '8px 24px', margin: '0 auto' }}>
                Reset All Filters
              </button>
            </div>
          )}

          {/* Product Cards Grid */}
          {!isLoading && !isError && products.length > 0 && (
            <div className="amz-product-grid">
              {products.map(product => {
                const mrp = product.mrpPaise || Math.round(product.pricePaise * 1.35);
                const discountPct = Math.round(((mrp - product.pricePaise) / mrp) * 100);
                const isSaved = wishlistIds.includes(product._id);
                const isBestSeller = product.badge?.includes('Best Seller') || product.ratingAverage >= 4.9;
                const isChoice = product.badge?.includes('Choice') || product.ratingAverage >= 4.8;

                return (
                  <article className="amz-product-card" key={product._id}>
                    {/* Badge */}
                    {isBestSeller ? (
                      <span className="amz-badge-bestseller">Best Seller</span>
                    ) : isChoice ? (
                      <span className="amz-badge-choice">Artisan <span>Pick</span></span>
                    ) : null}

                    {/* Wishlist Heart */}
                    {onToggleWishlist && (
                      <button
                        className={`amz-wishlist-heart ${isSaved ? 'active' : ''}`}
                        onClick={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          onToggleWishlist(product._id);
                          onShowNotice(isSaved ? 'Removed from your Wish List.' : 'Added to your Wish List.');
                        }}
                        aria-label="Add to Wishlist"
                      >
                        <Heart size={16} fill={isSaved ? 'currentColor' : 'none'} />
                      </button>
                    )}

                    {/* Image */}
                    <Link to={`/product/${product._id}`} className="amz-card-image-box">
                      <img src={product.imageUrl} alt={product.name} loading="lazy" />
                    </Link>

                    {/* Vendor Attribution */}
                    <span className="amz-card-vendor">
                      {product.category} · Artisan Studio
                    </span>

                    {/* Title */}
                    <Link to={`/product/${product._id}`} style={{ textDecoration: 'none' }}>
                      <h3 className="amz-card-title">{product.name}</h3>
                    </Link>

                    {/* Rating */}
                    <div className="amz-rating-row">
                      <div className="amz-stars">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            size={12}
                            fill={i < Math.floor(product.ratingAverage) ? 'currentColor' : 'none'}
                            stroke="currentColor"
                          />
                        ))}
                      </div>
                      <span className="amz-rating-num">
                        {product.ratingAverage.toFixed(1)} ({product.ratingCount})
                      </span>
                    </div>

                    <div className="amz-bought-count">
                      500+ bought in past month
                    </div>

                    {/* Pricing */}
                    <div className="amz-price-box">
                      <div style={{ display: 'flex', alignItems: 'baseline' }}>
                        <span className="amz-discount-pct">-{discountPct}%</span>
                        <span className="amz-price-current">
                          {formatPrice(product.pricePaise)}
                        </span>
                      </div>
                      <div className="amz-price-mrp">
                        M.R.P.: <s>{formatPrice(mrp)}</s>
                      </div>
                    </div>

                    {/* Prime / Delivery */}
                    <div className="amz-prime-line">
                      <span className="amz-prime-logo">✦ Express</span>
                      FREE delivery by <b>Tomorrow, 2 PM</b> to {deliveryPincode}
                    </div>

                    {/* Stock Urgency */}
                    {product.stock <= 10 && product.stock > 0 && (
                      <div className="amz-stock-urgency">
                        Only {product.stock} left in stock - order soon.
                      </div>
                    )}
                    {product.stock <= 0 && (
                      <div className="amz-stock-urgency" style={{ color: '#a63e32' }}>
                        Currently out of stock.
                      </div>
                    )}

                    {/* Dual Action Buttons */}
                    <div className="amz-card-actions">
                      <button
                        className="amz-btn-cart"
                        onClick={e => handleQuickAdd(e, product._id, product.name)}
                        disabled={product.stock <= 0}
                      >
                        <ShoppingBag size={15} /> Add to Bag
                      </button>
                      <button
                        className="amz-btn-buy"
                        onClick={e => handleBuyNow(e, product._id, product.name)}
                        disabled={product.stock <= 0}
                      >
                        <Zap size={14} /> Buy Now
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      </section>

      {/* 5. Footer */}
      <footer style={{ background: '#1e261e', color: '#dddddd', padding: '50px 24px 30px', marginTop: 40, borderTop: '1px solid #2d3b2e' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 36, fontSize: 13 }}>
          <div>
            <h4 style={{ color: '#f5f2e8', fontFamily: "'Playfair Display', serif", marginBottom: 14, fontSize: 16 }}>Get to Know Us</h4>
            <ul style={{ listStyle: 'none', display: 'grid', gap: 9 }}>
              <li><a href="#shop" style={{ color: '#a6aba0' }}>About Common Goods</a></li>
              <li><a href="#shop" style={{ color: '#a6aba0' }}>Artisan Provenance</a></li>
              <li><a href="#shop" style={{ color: '#a6aba0' }}>Fair Trade Standards</a></li>
              <li><a href="#shop" style={{ color: '#a6aba0' }}>Press & Media</a></li>
            </ul>
          </div>
          <div>
            <h4 style={{ color: '#f5f2e8', fontFamily: "'Playfair Display', serif", marginBottom: 14, fontSize: 16 }}>Connect with Us</h4>
            <ul style={{ listStyle: 'none', display: 'grid', gap: 9 }}>
              <li><a href="#shop" style={{ color: '#a6aba0' }}>Instagram</a></li>
              <li><a href="#shop" style={{ color: '#a6aba0' }}>Artisan Stories</a></li>
              <li><a href="#shop" style={{ color: '#a6aba0' }}>Studio Tours</a></li>
            </ul>
          </div>
          <div>
            <h4 style={{ color: '#f5f2e8', fontFamily: "'Playfair Display', serif", marginBottom: 14, fontSize: 16 }}>Make Money with Us</h4>
            <ul style={{ listStyle: 'none', display: 'grid', gap: 9 }}>
              <li><Link to="/vendor/dashboard" style={{ color: '#a6aba0' }}>Sell on Marketplace</Link></li>
              <li><Link to="/vendor/dashboard" style={{ color: '#a6aba0' }}>Supply to Artisan Express</Link></li>
              <li><Link to="/vendor/dashboard" style={{ color: '#a6aba0' }}>Artisan Acceleration Program</Link></li>
            </ul>
          </div>
          <div>
            <h4 style={{ color: '#f5f2e8', fontFamily: "'Playfair Display', serif", marginBottom: 14, fontSize: 16 }}>Let Us Help You</h4>
            <ul style={{ listStyle: 'none', display: 'grid', gap: 9 }}>
              <li><Link to="/orders" style={{ color: '#a6aba0' }}>Your Orders & Tracking</Link></li>
              <li><a href="#shop" style={{ color: '#a6aba0' }}>Returns & Replacements</a></li>
              <li><a href="#shop" style={{ color: '#a6aba0' }}>Artisan Guarantee</a></li>
              <li><a href="#shop" style={{ color: '#a6aba0' }}>Help & Customer Service</a></li>
            </ul>
          </div>
        </div>
        <div style={{ borderTop: '1px solid #2d3b2e', maxWidth: 1200, margin: '40px auto 0', paddingTop: 24, textAlign: 'center', fontSize: 12, color: '#888f82' }}>
          © 2026 Common Goods Artisanal Marketplace · Built for Internship Capstone Evaluation
        </div>
      </footer>
    </div>
  );
};
