import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Check, Shield, Star, Store, Truck } from 'lucide-react';
import { useAddReviewMutation, useCartQuery, useMeQuery, useProductQuery, useReviewsQuery, useUpdateCartMutation } from '../api';
import { formatPrice } from '../utils';

interface ProductDetailProps {
  onOpenCart: () => void;
  onOpenAuth: () => void;
  onShowNotice: (msg: string) => void;
}

export const ProductDetail: React.FC<ProductDetailProps> = ({ onOpenCart, onOpenAuth, onShowNotice }) => {
  const { id } = useParams<{ id: string }>();
  const { data: productData, isLoading, isError } = useProductQuery(id || '');
  const { data: reviewsData } = useReviewsQuery(id || '', { skip: !id });
  const { data: identity } = useMeQuery();
  const isCustomer = identity?.user?.role === 'CUSTOMER';
  const { data: cartData } = useCartQuery(undefined, { skip: !isCustomer });
  const [updateCart] = useUpdateCartMutation();
  const [addReview, addReviewState] = useAddReviewMutation();

  const [quantity, setQuantity] = useState(1);
  const [ratingInput, setRatingInput] = useState(5);
  const [headline, setHeadline] = useState('');
  const [comment, setComment] = useState('');
  const [reviewMsg, setReviewMsg] = useState('');

  if (isLoading) {
    return <div className="loading-state" style={{ padding: '80px 20px', textAlign: 'center' }}>Gathering product details…</div>;
  }

  if (isError || !productData?.item) {
    return (
      <div className="empty-state" style={{ padding: '80px 20px', textAlign: 'center' }}>
        <h2>Product not found</h2>
        <p style={{ margin: '8px 0 20px', color: '#6b7280' }}>The item you are searching for may have been archived or removed.</p>
        <Link to="/" className="primary-button"><ArrowLeft size={16} /> Return to Storefront</Link>
      </div>
    );
  }

  const product = productData.item;

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
      onShowNotice(`Added ${quantity} × ${product.name} to your bag.`);
      onOpenCart();
    } catch {
      onShowNotice('Could not add to bag. Check available stock.');
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
      setHeadline('');
      setComment('');
      setReviewMsg('Thank you! Your verified review has been published.');
    } catch (err: any) {
      setReviewMsg(err?.data?.error?.message || 'Failed to submit review.');
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '30px 24px 80px' }}>
      <div style={{ marginBottom: 20 }}>
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6b7280' }}>
          <ArrowLeft size={14} /> Back to all good things
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 48, alignItems: 'start' }}>
        {/* Gallery */}
        <div style={{ background: '#f5f4ef', borderRadius: 8, overflow: 'hidden', border: '1px solid #e7e5dc' }}>
          <img
            src={product.imageUrl}
            alt={product.name}
            style={{ width: '100%', height: 520, objectFit: 'cover', display: 'block' }}
          />
        </div>

        {/* Info Column */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#50684d', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            <span>{product.category}</span>
            <span>·</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Store size={13} /> Artisan Studio</span>
          </div>

          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 500, margin: '12px 0 10px', color: '#1f2937' }}>
            {product.name}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#b48a3e', fontSize: 14, fontWeight: 600 }}>
              <Star size={16} fill="currentColor" />
              <span>{product.ratingAverage.toFixed(1)}</span>
            </div>
            <span style={{ color: '#9ca3af' }}>·</span>
            <span style={{ color: '#6b7280', fontSize: 13 }}>{product.ratingCount} Customer Reviews</span>
            <span style={{ color: '#9ca3af' }}>·</span>
            <span style={{ color: product.stock > 0 ? '#16a34a' : '#dc2626', fontSize: 13, fontWeight: 600 }}>
              {product.stock > 0 ? `In Stock (${product.stock} available)` : 'Out of Stock'}
            </span>
          </div>

          <div style={{ fontSize: 28, fontWeight: 700, color: '#111827', marginBottom: 20 }}>
            {formatPrice(product.pricePaise)}
          </div>

          <p style={{ fontSize: 15, lineHeight: 1.8, color: '#4b5563', marginBottom: 28 }}>
            {product.description}
          </p>

          {/* Action Row */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #d1d5db', borderRadius: 6, height: 46 }}>
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                style={{ padding: '0 14px', height: '100%', background: 'none', border: 0, fontSize: 16 }}
              >
                -
              </button>
              <span style={{ padding: '0 12px', fontWeight: 600, fontSize: 14 }}>{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                style={{ padding: '0 14px', height: '100%', background: 'none', border: 0, fontSize: 16 }}
              >
                +
              </button>
            </div>

            <button
              className="primary-button"
              disabled={product.stock <= 0}
              onClick={handleAddToCart}
              style={{ flex: 1, height: 46, justifyContent: 'center', fontSize: 14 }}
            >
              Add to Bag · {formatPrice(product.pricePaise * quantity)}
            </button>
          </div>

          {/* Trust Guarantees */}
          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 20, display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#4b5563' }}>
              <Truck size={16} color="#50684d" />
              <span>Complimentary insured shipping on all orders over ₹500</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#4b5563' }}>
              <Shield size={16} color="#50684d" />
              <span>Direct maker payout guarantee with verified provenance</span>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews & Social Proof Section */}
      <section style={{ marginTop: 64, borderTop: '1px solid #e5e7eb', paddingTop: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28 }}>
          <div>
            <div className="eyebrow"><span className="eyebrow-line" /> VERIFIED REPUTATION</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, margin: '8px 0 0' }}>Customer Impressions</h2>
          </div>
          <div style={{ fontSize: 14, color: '#6b7280' }}>
            Rating: <strong>{product.ratingAverage.toFixed(1)} / 5</strong> based on {product.ratingCount} reviews
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 40, alignItems: 'start' }}>
          {/* Reviews List */}
          <div style={{ display: 'grid', gap: 16 }}>
            {(!reviewsData?.items || reviewsData.items.length === 0) ? (
              <div style={{ background: '#f9fafb', padding: 24, borderRadius: 8, color: '#6b7280', fontSize: 14 }}>
                No reviews yet. Be the first customer to leave an impression on this artisan piece.
              </div>
            ) : (
              reviewsData.items.map(rev => (
                <article
                  key={rev._id}
                  style={{
                    background: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: 20,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ display: 'flex', color: '#b48a3e' }}>
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            size={14}
                            fill={i < rev.rating ? 'currentColor' : 'none'}
                            color={i < rev.rating ? 'currentColor' : '#d1d5db'}
                          />
                        ))}
                      </div>
                      {rev.headline && <strong style={{ fontSize: 14, color: '#111827', marginLeft: 4 }}>{rev.headline}</strong>}
                    </div>
                    {rev.verifiedPurchase && (
                      <span style={{ fontSize: 11, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
                        <Check size={12} /> Verified Purchase
                      </span>
                    )}
                  </div>

                  <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: '0 0 10px' }}>{rev.comment}</p>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>By {rev.customerName} · {new Date(rev.createdAt).toLocaleDateString()}</div>
                </article>
              ))
            )}
          </div>

          {/* Write a Review Box */}
          <div style={{ background: '#faf9f5', border: '1px solid #e7e5dc', borderRadius: 8, padding: 24 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#111827' }}>Write an Impression</h3>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: '#6b7280' }}>Share your feedback with fellow conscious buyers.</p>

            <form onSubmit={handleReviewSubmit} style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: 6 }}>Rating Score</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRatingInput(star)}
                      style={{ background: 'none', border: 0, padding: 2, cursor: 'pointer', color: star <= ratingInput ? '#b48a3e' : '#d1d5db' }}
                    >
                      <Star size={22} fill={star <= ratingInput ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                </div>
              </div>

              <label style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', display: 'grid', gap: 4 }}>
                Review Headline (Optional)
                <input
                  value={headline}
                  onChange={e => setHeadline(e.target.value)}
                  placeholder="e.g. Masterful pottery and finish"
                  style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }}
                />
              </label>

              <label style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', display: 'grid', gap: 4 }}>
                Your Thoughts
                <textarea
                  required
                  rows={4}
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Detail the materials, longevity, and your unboxing experience…"
                  style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12, resize: 'vertical' }}
                />
              </label>

              {reviewMsg && (
                <div style={{ fontSize: 12, color: reviewMsg.includes('Thank') ? '#16a34a' : '#dc2626' }}>
                  {reviewMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={addReviewState.isLoading || !comment.trim()}
                className="primary-button"
                style={{ marginTop: 4, justifyContent: 'center' }}
              >
                Submit Review
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
};
