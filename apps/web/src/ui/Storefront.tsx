import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Heart, Search, Star } from 'lucide-react';
import { useCartQuery, useMeQuery, useProductsQuery, useUpdateCartMutation } from '../api';
import { formatPrice } from '../utils';

interface StorefrontProps {
  onOpenCart: () => void;
  onOpenAuth: () => void;
  onShowNotice: (msg: string) => void;
}

export const Storefront: React.FC<StorefrontProps> = ({ onOpenCart, onOpenAuth, onShowNotice }) => {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('relevance');

  const { data: identity } = useMeQuery();
  const isCustomer = identity?.user?.role === 'CUSTOMER';
  const { data: cartData } = useCartQuery(undefined, { skip: !isCustomer });
  const [updateCart] = useUpdateCartMutation();

  const { data, isLoading, isError } = useProductsQuery({
    q: search,
    ...(category ? { category } : {}),
    sort,
  });

  const products = data?.items ?? [];

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
      onShowNotice(`Added "${productName}" to your bag.`);
      onOpenCart();
    } catch {
      onShowNotice('Could not add to bag. Check available stock.');
    }
  };

  return (
    <div>
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="eyebrow-line" /> THE CURATED EDIT · AUTUMN 2026
          </div>
          <h1>
            Good things.<br />
            <em>Good people.</em>
          </h1>
          <p>
            An Amazon-style multi-vendor marketplace connecting conscious buyers with authentic makers across India. Direct maker payouts, fair commissions, and transparent provenance.
          </p>
          <a className="primary-button" href="#shop">
            Explore Handcrafted Goods <ArrowRight size={16} />
          </a>
          <div className="hero-footnote">
            <div className="avatar-stack">
              <i>J</i>
              <i>E</i>
              <i>D</i>
            </div>
            <span>
              Small-batch, big-hearted.<br />
              <b>Empowering 120+ independent workshops</b>
            </span>
          </div>
        </div>

        <div className="hero-art" aria-label="Curated handmade ceramics and accessories">
          <div className="hero-note note-top">
            A little more<br />meaningful <span>↘</span>
          </div>
          <div className="sun-disc" />
          <div className="product-sculpture">
            <div className="vase vase-one" />
            <div className="vase vase-two" />
            <div className="book-stack">
              <i /><i /><i />
            </div>
            <div className="stem">
              <i /><i /><i />
            </div>
          </div>
          <div className="art-caption">
            <span>OBJECTS WITH A STORY</span>
            <b>Made slowly, loved forever.</b>
          </div>
          <div className="hero-index">01 / 04</div>
        </div>
      </section>

      {/* Trust Strip */}
      <section className="trust-strip">
        <div>
          <span className="trust-icon">✳</span>
          <b>Made with Intention</b>
          <span>Pure natural materials & slow craft</span>
        </div>
        <div>
          <span className="trust-icon">↗</span>
          <b>Automated Split Payments</b>
          <span>Automated vendor routing via Razorpay</span>
        </div>
        <div>
          <span className="trust-icon">♡</span>
          <b>Verified Buyer Reviews</b>
          <span>Unbiased impressions & tax invoices</span>
        </div>
      </section>

      {/* Shop Section */}
      <section className="shop-section" id="shop">
        <div className="section-heading">
          <div>
            <div className="eyebrow"><span className="eyebrow-line" /> THE COLLECTION</div>
            <h2>Things to <em>keep.</em></h2>
          </div>

          {/* Search & Sort Tools */}
          <div className="shop-tools" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <label className="search-box">
              <Search size={16} />
              <input
                id="product-search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') setSearch(query); }}
                placeholder="Search pottery, carry, tea…"
              />
              <button onClick={() => setSearch(query)} aria-label="Search">
                <ArrowRight size={15} />
              </button>
            </label>

            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              style={{
                border: '1px solid #dcd9cf',
                background: '#fff',
                padding: '8px 12px',
                fontSize: 12,
                borderRadius: 4,
                color: '#374151',
              }}
            >
              <option value="relevance">Sort: Curated</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="rating">Highest Rated</option>
              <option value="newest">Just Arrived</option>
            </select>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="category-pills">
          <button className={!category ? 'active' : ''} onClick={() => setCategory('')}>
            All the Good Stuff
          </button>
          <button className={category === 'Home & Living' ? 'active' : ''} onClick={() => setCategory('Home & Living')}>
            Home & Living
          </button>
          <button className={category === 'Accessories & Wear' ? 'active' : ''} onClick={() => setCategory('Accessories & Wear')}>
            Accessories & Wear
          </button>
          <button className={category === 'Apothecary & Wellness' ? 'active' : ''} onClick={() => setCategory('Apothecary & Wellness')}>
            Apothecary & Wellness
          </button>
          <button className={category === 'Stationery & Paper' ? 'active' : ''} onClick={() => setCategory('Stationery & Paper')}>
            Stationery & Paper
          </button>
        </div>

        {isLoading && <div className="loading-state">Gathering handcrafted pieces…</div>}
        {isError && (
          <div className="empty-state">
            We couldn’t reach the collection just now. Please try again shortly.
          </div>
        )}

        {!isLoading && !isError && (
          <div className="product-grid">
            {products.map((product, index) => (
              <article className="product-card" key={product._id}>
                <Link to={`/product/${product._id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className={`product-image tone-${index % 4}`}>
                    <img src={product.imageUrl} alt={product.name} loading="lazy" />
                    <span className="image-tag">{['MAKER PICK', 'LOW IMPACT', 'SMALL BATCH', 'JUST IN'][index % 4]}</span>
                    <button
                      type="button"
                      aria-label={`Save ${product.name}`}
                      className="heart-button"
                      onClick={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        onShowNotice('Sign in to add this item to your saved wishlist.');
                      }}
                    >
                      <Heart size={16} />
                    </button>
                    <button
                      type="button"
                      className="quick-add"
                      onClick={e => handleQuickAdd(e, product._id, product.name)}
                    >
                      Add to bag <ArrowUpRight size={14} />
                    </button>
                  </div>

                  <div className="product-meta">
                    <span>{product.category}</span>
                    <span className="stars">
                      <Star size={11} fill="currentColor" /> {product.ratingAverage.toFixed(1)} ({product.ratingCount})
                    </span>
                  </div>

                  <div className="product-title-row">
                    <h3>{product.name}</h3>
                    <b>{formatPrice(product.pricePaise)}</b>
                  </div>

                  <p className="product-subtitle">{product.description}</p>
                </Link>
              </article>
            ))}
          </div>
        )}

        {!isLoading && !isError && products.length === 0 && (
          <div className="empty-state">No products found matching your search. Try adjusting your query or category filter.</div>
        )}
      </section>

      {/* Maker Banner */}
      <section className="maker-banner" id="makers">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> PEOPLE MAKE THE DIFFERENCE</div>
          <h2>Small shops.<br /><em>Big stories.</em></h2>
          <p>
            Behind every good thing is a person who made it with care. Get to know them, and the little details that make their work special.
          </p>
          <Link className="primary-button" to="/vendor/dashboard">
            Join as a Maker Partner <ArrowRight size={16} />
          </Link>
        </div>
        <div className="maker-photo">
          <div className="maker-orbit">GOOD<br />PEOPLE <span>✳</span></div>
          <div className="photo-label">STUDIO VISIT · JAIPUR, INDIA</div>
        </div>
      </section>

      {/* Footer */}
      <footer id="story">
        <Link className="wordmark" to="/">common<span>goods</span><i>.</i></Link>
        <span>A little more good in the everyday. Multi-Vendor Marketplace Platform.</span>
        <span>© 2026 Common Goods Marketplace · Built for Capstone Evaluation</span>
      </footer>
    </div>
  );
};
