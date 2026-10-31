import React from 'react';
import { Heart, ShoppingCart, Trash2, X } from 'lucide-react';
import { useProductsQuery, useUpdateCartMutation, useCartQuery, useMeQuery } from '../api';
import { formatPrice } from '../utils';

interface WishlistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  wishlistIds: string[];
  onRemove: (productId: string) => void;
  onOpenCart: () => void;
  onOpenAuth: () => void;
  onShowNotice: (msg: string) => void;
}

export const WishlistDrawer: React.FC<WishlistDrawerProps> = ({
  isOpen,
  onClose,
  wishlistIds,
  onRemove,
  onOpenCart,
  onOpenAuth,
  onShowNotice,
}) => {
  const { data: identity } = useMeQuery();
  const isCustomer = identity?.user?.role === 'CUSTOMER';
  const { data: cartData } = useCartQuery(undefined, { skip: !isCustomer });
  const [updateCart] = useUpdateCartMutation();

  const { data: productsData } = useProductsQuery({ limit: 40 });
  const allProducts = productsData?.items ?? [];
  const savedProducts = allProducts.filter(p => wishlistIds.includes(p._id));

  if (!isOpen) return null;

  const handleMoveToCart = async (productId: string, productName: string) => {
    if (!isCustomer) {
      onOpenAuth();
      return;
    }
    const items = (cartData?.items ?? []).map(i => ({ productId: i.product._id, quantity: i.quantity }));
    const match = items.find(i => i.productId === productId);
    if (match) {
      match.quantity += 1;
    } else {
      items.push({ productId, quantity: 1 });
    }
    await updateCart({ items });
    onRemove(productId);
    onShowNotice(`Moved "${productName}" to your Cart.`);
    onClose();
    onOpenCart();
  };

  return (
    <>
      <div className="amz-modal-backdrop" onClick={onClose} style={{ zIndex: 500 }} />
      <aside className="amz-cart-drawer">
        <div className="amz-cart-header">
          <h2>
            <Heart size={20} fill="#febd69" color="#febd69" /> Your Wish List ({savedProducts.length} items)
          </h2>
          <button onClick={onClose} style={{ color: '#fff' }}><X size={22} /></button>
        </div>

        <div className="amz-cart-body">
          {savedProducts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#565959' }}>
              <Heart size={44} color="#ccc" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: 18, color: '#0f1111', marginBottom: 8 }}>Your Wish List is empty</h3>
              <p style={{ fontSize: 13, marginBottom: 20 }}>Click the heart icon on any product to save items you love for later.</p>
              <button className="amz-btn-cart" onClick={onClose} style={{ width: 'auto', padding: '8px 24px', margin: '0 auto' }}>
                Browse Catalog
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              {savedProducts.map(p => (
                <div
                  key={p._id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '70px 1fr auto',
                    gap: 12,
                    padding: 12,
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    alignItems: 'center',
                    background: '#fff',
                  }}
                >
                  <img src={p.imageUrl} alt={p.name} style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: 4 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f1111', lineHeight: 1.3 }}>{p.name}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#b12704', marginTop: 4 }}>
                      {formatPrice(p.pricePaise)}
                    </div>
                    <div style={{ fontSize: 11, color: '#007600' }}>In Stock · Verified Artisan</div>
                  </div>

                  <div style={{ display: 'grid', gap: 6 }}>
                    <button
                      className="amz-btn-cart"
                      onClick={() => handleMoveToCart(p._id, p.name)}
                      style={{ fontSize: 11, padding: '4px 10px' }}
                    >
                      <ShoppingCart size={12} /> Move to Cart
                    </button>
                    <button
                      onClick={() => onRemove(p._id)}
                      style={{ fontSize: 11, color: '#767676', textAlign: 'center' }}
                    >
                      <Trash2 size={11} style={{ verticalAlign: 'middle', marginRight: 2 }} /> Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
