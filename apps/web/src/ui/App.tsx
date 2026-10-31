import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { Navbar } from './Navbar';
import { Storefront } from './Storefront';
import { ProductDetail } from './ProductDetail';
import { CustomerOrders } from './CustomerOrders';
import { VendorDashboard } from './VendorDashboard';
import { AdminDashboard } from './AdminDashboard';
import { AuthModal } from './AuthModal';
import { CartDrawer } from './CartDrawer';
import { PincodeModal } from './PincodeModal';
import { WishlistDrawer } from './WishlistDrawer';
import { useCartQuery, useMeQuery } from '../api';

export function App() {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [cartOpen, setCartOpen] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [deliveryPincode, setDeliveryPincode] = useState('110001');
  const [toastNotice, setToastNotice] = useState('');

  // Wishlist persisted in localStorage
  const [wishlistIds, setWishlistIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('amz_wishlist');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('amz_wishlist', JSON.stringify(wishlistIds));
    } catch {}
  }, [wishlistIds]);

  const toggleWishlist = (productId: string) => {
    setWishlistIds(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  const navigate = useNavigate();
  const { data: identity } = useMeQuery();
  const isCustomer = identity?.user?.role === 'CUSTOMER';
  const { data: cartData } = useCartQuery(undefined, { skip: !isCustomer });

  const bagCount = cartData?.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  const handleOpenAuth = (mode: 'login' | 'register' = 'login') => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  const handleOrderSuccess = (orderId: string) => {
    setToastNotice(`🎉 Order placed successfully! Reference: #${orderId.slice(-8).toUpperCase()}`);
    navigate('/orders');
  };

  return (
    <div className="site-shell">
      <Navbar
        cartCount={bagCount}
        deliveryPincode={deliveryPincode}
        onOpenCart={() => setCartOpen(true)}
        onOpenAuth={handleOpenAuth}
        onOpenPinModal={() => setPinModalOpen(true)}
        onOpenWishlist={() => setWishlistOpen(true)}
        wishlistCount={wishlistIds.length}
      />

      <main id="top">
        <Routes>
          <Route
            path="/"
            element={
              <Storefront
                onOpenCart={() => setCartOpen(true)}
                onOpenAuth={() => handleOpenAuth('login')}
                onShowNotice={msg => setToastNotice(msg)}
                onToggleWishlist={toggleWishlist}
                wishlistIds={wishlistIds}
                deliveryPincode={deliveryPincode}
              />
            }
          />
          <Route
            path="/product/:id"
            element={
              <ProductDetail
                onOpenCart={() => setCartOpen(true)}
                onOpenAuth={() => handleOpenAuth('login')}
                onShowNotice={msg => setToastNotice(msg)}
                deliveryPincode={deliveryPincode}
                onOpenPinModal={() => setPinModalOpen(true)}
                onToggleWishlist={toggleWishlist}
                wishlistIds={wishlistIds}
              />
            }
          />
          <Route path="/orders" element={<CustomerOrders />} />
          <Route path="/vendor/dashboard" element={<VendorDashboard />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
        </Routes>
      </main>

      {/* Global Toast */}
      {toastNotice && (
        <div className="toast" role="status" style={{ background: '#131921', color: '#fff', borderLeft: '4px solid #febd69' }}>
          <Check size={16} color="#febd69" />
          <span>{toastNotice}</span>
          <button onClick={() => setToastNotice('')} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Modals & Drawers */}
      <AuthModal
        isOpen={authOpen}
        defaultMode={authMode}
        onClose={() => setAuthOpen(false)}
        onSuccess={msg => setToastNotice(msg)}
      />

      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        onOpenAuth={() => handleOpenAuth('login')}
        onOrderSuccess={handleOrderSuccess}
        deliveryPincode={deliveryPincode}
      />

      <PincodeModal
        isOpen={pinModalOpen}
        currentPin={deliveryPincode}
        onClose={() => setPinModalOpen(false)}
        onSelectPin={(pin, city) => {
          setDeliveryPincode(pin);
          setToastNotice(`Delivery location set to ${city} (${pin}).`);
        }}
      />

      <WishlistDrawer
        isOpen={wishlistOpen}
        onClose={() => setWishlistOpen(false)}
        wishlistIds={wishlistIds}
        onRemove={toggleWishlist}
        onOpenCart={() => setCartOpen(true)}
        onOpenAuth={() => handleOpenAuth('login')}
        onShowNotice={msg => setToastNotice(msg)}
      />
    </div>
  );
}
