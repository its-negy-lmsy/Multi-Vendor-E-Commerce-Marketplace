import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, LogOut, Package, Shield, ShoppingBag, Sparkles, Store, User as UserIcon } from 'lucide-react';
import { useLogoutMutation, useMeQuery } from '../api';

interface NavbarProps {
  cartCount: number;
  onOpenCart: () => void;
  onOpenAuth: (mode?: 'login' | 'register') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ cartCount, onOpenCart, onOpenAuth }) => {
  const { data: identity } = useMeQuery();
  const [logout] = useLogoutMutation();
  const navigate = useNavigate();
  const user = identity?.user;

  const handleLogout = async () => {
    await logout().unwrap();
    navigate('/');
  };

  return (
    <>
      <div className="announcement">
        <Sparkles size={14} /> 
        <span>Special Launch Offer: Use code <strong>WELCOME10</strong> for 10% off handcrafted artisan goods</span>
        <span className="announcement-link">
          Free Express Delivery Across India <ArrowRight size={12} />
        </span>
      </div>

      <header className="header">
        <Link to="/" className="wordmark">
          common<span>goods</span><i>.</i>
        </Link>

        <nav className="main-nav">
          <Link to="/">Shop Collection</Link>
          {user?.role === 'CUSTOMER' && (
            <Link to="/orders" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Package size={14} /> My Orders
            </Link>
          )}
          {(user?.role === 'VENDOR' || user?.role === 'CUSTOMER') && (
            <Link to="/vendor/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Store size={14} /> Vendor Studio
            </Link>
          )}
          {user?.role === 'ADMIN' && (
            <Link to="/admin/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#99583d', fontWeight: 600 }}>
              <Shield size={14} /> Admin Command
            </Link>
          )}
        </nav>

        <div className="header-actions">
          {user ? (
            <div className="user-dropdown-container" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>
                Hi, <strong>{user.name.split(' ')[0]}</strong> ({user.role})
              </span>
              <button
                className="icon-button"
                onClick={handleLogout}
                title="Sign out"
                style={{ padding: 6, color: '#6b7280' }}
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button className="text-button account-button" onClick={() => onOpenAuth('login')}>
              <UserIcon size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Sign in
            </button>
          )}

          <button className="bag-button" onClick={onOpenCart}>
            <ShoppingBag size={18} />
            <span>Bag</span>
            <b>{cartCount}</b>
          </button>
        </div>
      </header>
    </>
  );
};
