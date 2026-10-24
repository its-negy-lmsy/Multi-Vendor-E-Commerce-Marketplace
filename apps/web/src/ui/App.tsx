import { useState } from 'react';
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
import { useCartQuery, useMeQuery } from '../api';

export function App() {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [cartOpen, setCartOpen] = useState(false);
  const [toastNotice, setToastNotice] = useState('');

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
    setToastNotice(`Order placed successfully! Reference: #${orderId.slice(-8).toUpperCase()}`);
    navigate('/orders');
  };

  return (
    <div className="site-shell">
      <Navbar
        cartCount={bagCount}
        onOpenCart={() => setCartOpen(true)}
        onOpenAuth={handleOpenAuth}
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
        <div className="toast" role="status">
          <Check size={16} />
          <span>{toastNotice}</span>
          <button onClick={() => setToastNotice('')} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Modals */}
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
      />
    </div>
  );
}
