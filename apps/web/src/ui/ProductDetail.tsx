import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronRight,
  Heart,
  Lock,
  MapPin,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Star,
  ThumbsUp,
  Truck,
  Zap,
} from 'lucide-react';
import {
  useAddReviewMutation,
  useCartQuery,
  useMeQuery,
  useProductQuery,
  useProductsQuery,
  useReviewsQuery,
  useUpdateCartMutation,
} from '../api';
import { formatPrice } from '../utils';

interface ProductDetailProps {
  onOpenCart: () => void;
  onOpenAuth: () => void;
  onShowNotice: (msg: string) => void;
  deliveryPincode?: string;
  onOpenPinModal?: () => void;
  onToggleWishlist?: (productId: string) => void;
  wishlistIds?: string[];
}

export const ProductDetail: React.FC<ProductDetailProps> = ({
  onOpenCart,
  onOpenAuth,
  onShowNotice,
  deliveryPincode = '110001',
  onOpenPinModal,
  onToggleWishlist,
  wishlistIds = [],
}) => {
  const { id } = useParams<{ id: string }>();

  const { data: productData, isLoading, isError } = useProductQuery(id || '');
  const { data: reviewsData } = useReviewsQuery(id || '', { skip: !id });

  const { data: identity } = useMeQuery();
  const isCustomer = identity?.user?.role === 'CUSTOMER';
  const { data: cartData } = useCartQuery(undefined, { skip: !isCustomer });
  const { data: allProductsData } = useProductsQuery({ limit: 12 });
  const otherProducts = (allProductsData?.items ?? []).filter(p => p._id !== (id || ''));
  const bundleItem1 = otherProducts[0];
  const bundleItem2 = otherProducts[1];

  const [updateCart] = useUpdateCartMutation();
  const [addReview, addReviewState] = useAddReviewMutation();

  const [quantity, setQuantity] = useState(1);
  const [selectedThumb, setSelectedThumb] = useState(0);
  const [isCouponClipped, setIsCouponClipped] = useState(false);
  const [helpfulVotes, setHelpfulVotes] = useState<Record<string, number>>({});

  // Review Modal State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [ratingInput, setRatingInput] = useState(5);
  const [headline, setHeadline] = useState('');
  const [comment, setComment] = useState('');
  const [reviewMsg, setReviewMsg] = useState('');

  // Q&A State
  const [qaSearch, setQaSearch] = useState('');

  if (isLoading) {
    return (
      <div style={{ maxWidth: 1200, margin: '80px auto', textAlign: 'center', padding: 20 }}>
        <h2>Loading Artisan Product Details…</h2>
      </div>
    );
  }

  if (isError || !productData?.item) {
    return (
      <div style={{ maxWidth: 700, margin: '80px auto', textAlign: 'center', background: '#fff', padding: 40, borderRadius: 8 }}>
        <h2>Looking for something?</h2>
        <p style={{ margin: '12px 0 24px', color: '#565959' }}>
          We couldn't find the product matching that address. The item might have been archived or removed by its maker.
        </p>
        <Link to="/" className="amz-btn-cart" style={{ display: 'inline-flex', width: 'auto', padding: '10px 24px' }}>
          <ArrowLeft size={16} /> Return to Marketplace Storefront
        </Link>
      </div>
    );
  }

  const product = productData.item;
  const reviews = reviewsData?.items ?? [];
  const isSaved = wishlistIds.includes(product._id);

  const mrp = product.mrpPaise || Math.round(product.pricePaise * 1.35);
  const discountPct = Math.round(((mrp - product.pricePaise) / mrp) * 100);

  // Gallery Images
  const galleryImages = [
    product.imageUrl,
    'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80',
  ];

  const handleAddToCart = async () => {
    if (!isCustomer) {
      onOpenAuth();
      return;
    }
    const items = (cartData?.items ?? []).map(i => ({ productId: i.product._id, quantity: i.quantity }));
    const match = items.find(i => i.productId === product._id);
    if (match) {
      match.quantity = Math.min(20, match.quantity + quantity);
    } else {
      items.push({ productId: product._id, quantity });
    }
    try {
      await updateCart({ items }).unwrap();
      onShowNotice(`Added ${quantity} × "${product.name}" to your Cart.`);
      onOpenCart();
    } catch {
      onShowNotice('Could not add to cart. Check available stock.');
    }
  };

  const handleBuyNow = async () => {
    if (!isCustomer) {
      onOpenAuth();
      return;
    }
    const items = (cartData?.items ?? []).map(i => ({ productId: i.product._id, quantity: i.quantity }));
    const match = items.find(i => i.productId === product._id);
    if (match) {
      match.quantity = Math.min(20, match.quantity + quantity);
    } else {
      items.push({ productId: product._id, quantity });
    }
    try {
      await updateCart({ items }).unwrap();
      onOpenCart();
    } catch {
      onShowNotice('Could not start checkout.');
    }
  };

  const handleAddBundleToCart = async () => {
    if (!isCustomer) {
      onOpenAuth();
      return;
    }
    const items = (cartData?.items ?? []).map(i => ({ productId: i.product._id, quantity: i.quantity }));
    const toAdd = [product._id];
    if (bundleItem1) toAdd.push(bundleItem1._id);
    if (bundleItem2) toAdd.push(bundleItem2._id);

    for (const pId of toAdd) {
      const match = items.find(i => i.productId === pId);
      if (match) {
        match.quantity = Math.min(20, match.quantity + 1);
      } else {
        items.push({ productId: pId, quantity: 1 });
      }
    }

    try {
      await updateCart({ items }).unwrap();
      onShowNotice(`Added complete 3-piece artisan bundle to your Cart!`);
      onOpenCart();
    } catch {
      onShowNotice('Could not add bundle to cart. Check available stock.');
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCustomer) {
      onOpenAuth();
      return;
    }
    setReviewMsg('');
    try {
      await addReview({
        productId: product._id,
        rating: ratingInput,
        headline,
        comment,
      }).unwrap();
      setShowReviewModal(false);
      setHeadline('');
      setComment('');
      onShowNotice('Thank you! Your verified review has been published.');
    } catch (err: any) {
      setReviewMsg(err?.data?.error?.message || 'Failed to submit review.');
    }
  };

  const handleVoteHelpful = (reviewId: string) => {
    setHelpfulVotes(prev => ({ ...prev, [reviewId]: (prev[reviewId] || 0) + 1 }));
    onShowNotice('Thank you for your feedback.');
  };

  // Sample FAQs
  const faqs = [
    {
      q: 'Is this item handcrafted or machine manufactured?',
      a: 'This item is 100% handcrafted by verified artisan makers using traditional slow-craft methods and responsibly sourced natural materials.',
    },
    {
      q: 'How long will delivery take to my pincode?',
      a: `Standard express delivery takes 24 to 48 hours for metro locations (including PIN ${deliveryPincode}). Handcrafted orders are packaged with eco-friendly molded pulp buffers.`,
    },
    {
      q: 'What is the return and replacement policy?',
      a: 'We offer an A-to-Z 7-day hassle-free replacement guarantee. If your piece arrives damaged or has any artisanal defect, we dispatch an immediate replacement or full refund.',
    },
    {
      q: 'Does it come with an official GST Tax Invoice?',
      a: 'Yes, an official GST tax invoice with the maker’s registration and platform details is automatically generated upon checkout and downloadable anytime from Your Orders.',
    },
  ];

  const filteredFaqs = faqs.filter(f =>
    f.q.toLowerCase().includes(qaSearch.toLowerCase()) || f.a.toLowerCase().includes(qaSearch.toLowerCase())
  );

  return (
    <div className="amz-pdp-wrap">
      {/* 1. Amazon Breadcrumbs */}
      <nav className="amz-breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link> <ChevronRight size={12} />
        <Link to={`/?cat=${encodeURIComponent(product.category)}`}>{product.category}</Link> <ChevronRight size={12} />
        <span style={{ color: '#0f1111', fontWeight: 600 }}>{product.name}</span>
      </nav>

      {/* 2. Main 3-Column PDP Grid */}
      <div className="amz-pdp-grid">
        {/* Column 1: Image Gallery */}
        <div className="amz-pdp-gallery">
          <div className="amz-pdp-thumbs">
            {galleryImages.map((img, idx) => (
              <div
                key={idx}
                className={`amz-pdp-thumb ${idx === selectedThumb ? 'active' : ''}`}
                onMouseEnter={() => setSelectedThumb(idx)}
                onClick={() => setSelectedThumb(idx)}
              >
                <img src={img} alt={`${product.name} view ${idx + 1}`} />
              </div>
            ))}
          </div>

          <div className="amz-pdp-main-img">
            <img src={galleryImages[selectedThumb] || product.imageUrl} alt={product.name} />
          </div>
        </div>

        {/* Column 2: Center Product Details */}
        <div className="amz-pdp-center">
          <Link to="/" className="amz-pdp-brand">
            Brand: Artisan Studio Partners | Visit the Store
          </Link>

          <h1 className="amz-pdp-title">{product.name}</h1>

          {/* Ratings & Q&A link row */}
          <div className="amz-pdp-ratings-line">
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontWeight: 700, color: '#0f1111' }}>{product.ratingAverage.toFixed(1)}</span>
              <div className="amz-stars">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={14}
                    fill={i < Math.floor(product.ratingAverage) ? 'currentColor' : 'none'}
                    stroke="currentColor"
                  />
                ))}
              </div>
            </div>
            <a href="#reviews" style={{ fontSize: 13, color: '#455d46' }}>
              {product.ratingCount} ratings
            </a>
            <span style={{ color: '#ccc' }}>|</span>
            <a href="#qa" style={{ fontSize: 13, color: '#455d46' }}>
              14 answered questions
            </a>
          </div>

          {/* Artisan Pick Tag */}
          <div style={{ marginBottom: 14 }}>
            <span className="amz-badge-choice" style={{ position: 'static', display: 'inline-block' }}>
              Artisan <span style={{ color: '#febd69' }}>Pick</span>
            </span>
            <span style={{ fontSize: 12, color: '#72766d', marginLeft: 8 }}>
              for "{product.category}"
            </span>
          </div>

          {/* Price Section */}
          <div className="amz-pdp-price-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="amz-deal-badge">Limited Time Deal</span>
              <span className="amz-discount-pct">-{discountPct}%</span>
              <div className="amz-pdp-current-price">
                {formatPrice(product.pricePaise)}
              </div>
            </div>

            <div style={{ fontSize: 13, color: '#72766d' }}>
              Typical M.R.P.: <s style={{ textDecoration: 'line-through' }}>{formatPrice(mrp)}</s>
            </div>
            <div className="amz-pdp-taxes">Inclusive of all taxes</div>

            <div className="amz-pdp-emi">
              <b>EMI</b> starts at ₹{Math.round(product.pricePaise / 2400)} per month. No Cost EMI available.
            </div>

            {/* Clip Coupon Box */}
            <div className="amz-clip-coupon-box">
              <input
                type="checkbox"
                id="clip-coupon"
                checked={isCouponClipped}
                onChange={e => {
                  setIsCouponClipped(e.target.checked);
                  onShowNotice(e.target.checked ? 'Coupon clipped! Extra 10% discount applied at checkout.' : 'Coupon unclipped.');
                }}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              <label htmlFor="clip-coupon" style={{ cursor: 'pointer', fontSize: 13, color: '#242b23' }}>
                <span className="amz-coupon-badge">Coupon</span> Save an extra <b>10%</b> with coupon code <b>WELCOME10</b> at checkout.
              </label>
            </div>
          </div>

          {/* Trust Icons Matrix */}
          <div className="amz-pdp-trust-matrix">
            <div className="amz-pdp-trust-col">
              <Truck size={24} />
              <span>Complimentary Express Delivery</span>
            </div>
            <div className="amz-pdp-trust-col">
              <RotateCcw size={24} />
              <span>7 Days Replacement</span>
            </div>
            <div className="amz-pdp-trust-col">
              <ShieldCheck size={24} />
              <span>100% Genuine Handcrafted</span>
            </div>
            <div className="amz-pdp-trust-col">
              <Lock size={24} />
              <span>Secure Split Escrow</span>
            </div>
          </div>

          {/* About this Item Feature Bullets */}
          <div className="amz-pdp-bullets">
            <h3 className="amz-pdp-bullets-title">About this item</h3>
            <ul>
              <li>
                <strong>Handcrafted Studio Craft:</strong> Wheel-thrown, hand-stitched, or small-batch blended by master artisans across India with transparent maker attribution.
              </li>
              <li>
                <strong>Premium Natural Materials:</strong> Uses pure indigenous clay, virgin metals, vegetable-tanned leather, or therapeutic botanicals with zero synthetic fillers.
              </li>
              <li>
                <strong>Direct Maker Support:</strong> 90% of your purchase goes directly to the independent maker with automated split payments via Razorpay Route escrow.
              </li>
              <li>
                <strong>Rigorous Quality Check:</strong> Every single batch passes through dimensional tolerance, finishing, and packaging tests before shipping.
              </li>
              <li>
                <strong>Complete GST Compliance:</strong> Full downloadable tax invoice and tracking number delivered to your dashboard upon placement.
              </li>
            </ul>
          </div>

          {/* Specifications Table */}
          <div style={{ marginTop: 24 }}>
            <h3 className="amz-pdp-bullets-title">Product specifications</h3>
            <table className="amz-specs-table">
              <tbody>
                <tr>
                  <td>Department / Category</td>
                  <td>{product.category}</td>
                </tr>
                <tr>
                  <td>Stock Status</td>
                  <td>{product.stock > 0 ? `${product.stock} units available` : 'Out of Stock'}</td>
                </tr>
                {product.specs && Object.entries(product.specs).map(([key, val]) => (
                  <tr key={key}>
                    <td>{key}</td>
                    <td>{val}</td>
                  </tr>
                ))}
                <tr>
                  <td>Customer Rating</td>
                  <td>{product.ratingAverage.toFixed(1)} out of 5 stars</td>
                </tr>
                <tr>
                  <td>Country of Origin</td>
                  <td>India</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Column 3: The Authentic Amazon Buy Box */}
        <aside className="amz-buybox">
          <div className="amz-buybox-price">
            {formatPrice(product.pricePaise)}
          </div>

          <div className="amz-buybox-delivery">
            <span className="amz-prime-logo">✦ Express</span>
            FREE delivery <b>Tomorrow by 2 PM</b>. Order within <b>4 hrs 18 mins</b>.
          </div>

          <div className="amz-buybox-location" onClick={onOpenPinModal}>
            <MapPin size={14} /> Deliver to New Delhi {deliveryPincode}
          </div>

          {product.stock > 0 ? (
            <div className={`amz-buybox-stock ${product.stock <= 5 ? 'low' : ''}`}>
              {product.stock <= 5 ? `Only ${product.stock} left in stock - order soon.` : 'In Stock'}
            </div>
          ) : (
            <div className="amz-buybox-stock low">Currently Unavailable</div>
          )}

          {/* Quantity Selector */}
          <div className="amz-buybox-qty">
            <label htmlFor="qty-select">Quantity:</label>
            <select
              id="qty-select"
              value={quantity}
              onChange={e => setQuantity(parseInt(e.target.value, 10))}
              disabled={product.stock <= 0}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(q => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>

          {/* Add to Bag (Moss) */}
          <button
            className="amz-btn-cart"
            onClick={handleAddToCart}
            disabled={product.stock <= 0}
            style={{ marginBottom: 8 }}
          >
            <ShoppingBag size={16} /> Add to Bag
          </button>

          {/* Buy Now (Terracotta) */}
          <button
            className="amz-btn-buy"
            onClick={handleBuyNow}
            disabled={product.stock <= 0}
          >
            <Zap size={15} /> Buy Now
          </button>

          {/* Buy Box Seller & Dispatch Metadata */}
          <div className="amz-buybox-meta">
            <span>Ships from</span>
            <b>Artisan Express</b>
            <span>Sold by</span>
            <b>Artisan Partner Studio</b>
            <span>Payment</span>
            <b>Secure transaction</b>
          </div>

          {/* Gift options */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#0f1111', cursor: 'pointer', marginTop: 12 }}>
            <input type="checkbox" />
            <span>Add gift options at checkout</span>
          </label>

          {/* Wishlist Button */}
          {onToggleWishlist && (
            <button
              onClick={() => {
                onToggleWishlist(product._id);
                onShowNotice(isSaved ? 'Removed from your Wish List.' : 'Added to your Wish List.');
              }}
              style={{
                width: '100%',
                marginTop: 14,
                padding: '6px 12px',
                border: '1px solid #d5d9d9',
                borderRadius: 4,
                background: '#ffffff',
                fontSize: 12,
                color: '#0f1111',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Heart size={14} fill={isSaved ? '#b12704' : 'none'} color={isSaved ? '#b12704' : 'currentColor'} />
              {isSaved ? 'Remove from Wish List' : 'Add to Wish List'}
            </button>
          )}

          <div className="amz-buybox-security">
            <Lock size={13} /> Your transaction is secure
          </div>
        </aside>
      </div>

      {/* 3. Frequently Bought Together Bundle Widget */}
      {bundleItem1 && bundleItem2 && (
        <section className="amz-bundle-box">
          <h3 className="amz-bundle-title">Frequently bought together</h3>
          <div className="amz-bundle-row">
            <Link to={`/product/${product._id}`} className="amz-bundle-item" title={product.name}>
              <img src={product.imageUrl} alt={product.name} />
            </Link>
            <span className="amz-bundle-plus">+</span>
            <Link to={`/product/${bundleItem1._id}`} className="amz-bundle-item" title={bundleItem1.name}>
              <img src={bundleItem1.imageUrl} alt={bundleItem1.name} />
            </Link>
            <span className="amz-bundle-plus">+</span>
            <Link to={`/product/${bundleItem2._id}`} className="amz-bundle-item" title={bundleItem2.name}>
              <img src={bundleItem2.imageUrl} alt={bundleItem2.name} />
            </Link>

            <div className="amz-bundle-calc">
              <div className="amz-bundle-total">
                Total price: <b>{formatPrice(product.pricePaise + bundleItem1.pricePaise + bundleItem2.pricePaise)}</b>
              </div>
              <button
                className="amz-btn-cart"
                style={{ width: 'auto', padding: '8px 20px' }}
                onClick={handleAddBundleToCart}
              >
                Add all three to Bag
              </button>
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: '#72766d', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div>• <b>This item:</b> {product.name} ({formatPrice(product.pricePaise)})</div>
            <div>• <Link to={`/product/${bundleItem1._id}`} style={{ color: '#455d46' }}>{bundleItem1.name}</Link> ({formatPrice(bundleItem1.pricePaise)})</div>
            <div>• <Link to={`/product/${bundleItem2._id}`} style={{ color: '#455d46' }}>{bundleItem2.name}</Link> ({formatPrice(bundleItem2.pricePaise)})</div>
          </div>
        </section>
      )}

      {/* 4. Customer Questions & Answers Section */}
      <section id="qa" style={{ marginTop: 40, borderTop: '1px solid #d5d9d9', paddingTop: 24 }}>
        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Customer questions & answers</h3>
        <input
          type="text"
          placeholder="Have a question? Search for answers…"
          value={qaSearch}
          onChange={e => setQaSearch(e.target.value)}
          style={{
            width: '100%',
            maxWidth: 600,
            padding: '10px 14px',
            border: '1px solid #888c8c',
            borderRadius: 4,
            fontSize: 13,
            marginBottom: 20,
          }}
        />

        <div style={{ display: 'grid', gap: 14 }}>
          {filteredFaqs.map((faq, idx) => (
            <div
              key={idx}
              style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                padding: '14px 18px',
              }}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontWeight: 800, color: '#455d46', fontSize: 13 }}>Q:</span>
                <span style={{ fontWeight: 700, color: '#0f1111', fontSize: 14 }}>{faq.q}</span>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 8 }}>
                <span style={{ fontWeight: 800, color: '#0f1111', fontSize: 13 }}>A:</span>
                <span style={{ color: '#374151', fontSize: 13, lineHeight: 1.5 }}>{faq.a}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Comprehensive Reviews Section */}
      <section id="reviews" className="amz-reviews-section">
        {/* Left: Overall Rating Breakdown */}
        <div>
          <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Customer reviews</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div className="amz-stars">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  size={18}
                  fill={i < Math.floor(product.ratingAverage) ? 'currentColor' : 'none'}
                  stroke="currentColor"
                />
              ))}
            </div>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#0f1111' }}>
              {product.ratingAverage.toFixed(1)} out of 5
            </span>
          </div>
          <div style={{ fontSize: 13, color: '#565959', marginBottom: 16 }}>
            {product.ratingCount} global ratings
          </div>

          {/* Rating Progress Bars */}
          <div className="amz-review-bars">
            {[
              { star: 5, pct: 72 },
              { star: 4, pct: 18 },
              { star: 3, pct: 6 },
              { star: 2, pct: 2 },
              { star: 1, pct: 2 },
            ].map(r => (
              <div className="amz-review-bar-row" key={r.star}>
                <span style={{ width: 44, color: '#455d46', fontWeight: 600 }}>{r.star} star</span>
                <div className="amz-review-bar-track">
                  <div className="amz-review-bar-fill" style={{ width: `${r.pct}%` }} />
                </div>
                <span style={{ width: 32, textAlign: 'right', color: '#565959' }}>{r.pct}%</span>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid #d5d9d9', marginTop: 24, paddingTop: 20 }}>
            <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Review this product</h4>
            <p style={{ fontSize: 13, color: '#565959', marginBottom: 14 }}>
              Share your thoughts with other customers. Verified buyers help build artisan trust.
            </p>
            <button
              onClick={() => {
                if (!isCustomer) onOpenAuth();
                else setShowReviewModal(true);
              }}
              style={{
                width: '100%',
                padding: '8px 16px',
                border: '1px solid #d5d9d9',
                borderRadius: 4,
                background: '#ffffff',
                fontSize: 13,
                fontWeight: 600,
                color: '#0f1111',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              Write a customer review
            </button>
          </div>
        </div>

        {/* Right: Customer Reviews Feed */}
        <div>
          <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
            Top reviews from verified purchasers
          </h4>

          {reviews.length === 0 ? (
            <div style={{ background: '#f9fafb', padding: 24, borderRadius: 6, color: '#565959' }}>
              No reviews written yet. Be the first to review this artisanal masterpiece!
            </div>
          ) : (
            reviews.map(review => (
              <div className="amz-review-card" key={review._id}>
                <div className="amz-review-author">
                  <div className="amz-review-avatar">
                    {review.customerName.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#0f1111' }}>
                    {review.customerName}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div className="amz-stars">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={13}
                        fill={i < review.rating ? 'currentColor' : 'none'}
                        stroke="currentColor"
                      />
                    ))}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0f1111' }}>
                    {review.headline || 'Excellent quality & craft'}
                  </span>
                </div>

                <div style={{ fontSize: 12, color: '#565959', marginBottom: 6 }}>
                  Reviewed in India on {new Date(review.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>

                {review.verifiedPurchase && (
                  <div className="amz-verified-tag" style={{ marginBottom: 8 }}>
                    Verified Purchase
                  </div>
                )}

                <p style={{ fontSize: 13, lineHeight: 1.5, color: '#0f1111', marginBottom: 12 }}>
                  {review.comment}
                </p>

                {/* Helpful Vote Button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: '#565959' }}>
                  <span>{helpfulVotes[review._id] ? `${helpfulVotes[review._id]} people found this helpful` : 'Was this review helpful?'}</span>
                  <button
                    onClick={() => handleVoteHelpful(review._id)}
                    style={{
                      border: '1px solid #d5d9d9',
                      padding: '3px 12px',
                      borderRadius: 4,
                      background: '#ffffff',
                      fontSize: 12,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      color: '#0f1111',
                    }}
                  >
                    <ThumbsUp size={12} /> Helpful
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Review Submission Modal */}
      {showReviewModal && (
        <div className="amz-modal-backdrop" onClick={() => setShowReviewModal(false)}>
          <div
            className="amz-checkout-modal"
            style={{ maxWidth: 540, padding: 24 }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Create Review</h3>
            <p style={{ fontSize: 13, color: '#565959', marginBottom: 16 }}>
              {product.name}
            </p>

            {reviewMsg && (
              <div style={{ color: '#b12704', fontSize: 13, marginBottom: 12 }}>{reviewMsg}</div>
            )}

            <form onSubmit={handleReviewSubmit} style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 6 }}>Overall rating</label>
                <div style={{ display: 'flex', gap: 6, color: '#de7921', cursor: 'pointer' }}>
                  {[1, 2, 3, 4, 5].map(st => (
                    <button
                      type="button"
                      key={st}
                      onClick={() => setRatingInput(st)}
                      style={{ color: 'inherit' }}
                    >
                      <Star size={24} fill={st <= ratingInput ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 6 }}>Add a headline</label>
                <input
                  type="text"
                  placeholder="What's most important to know?"
                  value={headline}
                  onChange={e => setHeadline(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d5d9d9', borderRadius: 4 }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 6 }}>Add a written review</label>
                <textarea
                  placeholder="What did you like or dislike? How was the unboxing and craft finish?"
                  rows={4}
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d5d9d9', borderRadius: 4, resize: 'vertical' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  style={{ padding: '8px 16px', border: '1px solid #d5d9d9', borderRadius: 4, background: '#fff' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="amz-btn-cart"
                  style={{ width: 'auto', padding: '8px 24px' }}
                  disabled={addReviewState.isLoading}
                >
                  {addReviewState.isLoading ? 'Submitting…' : 'Submit Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
