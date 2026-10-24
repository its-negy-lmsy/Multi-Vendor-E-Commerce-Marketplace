import React, { useState } from 'react';
import { ArrowRight, Shield, Store, User, X } from 'lucide-react';
import { useLoginMutation, useRegisterMutation } from '../api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'register';
  onSuccess?: (msg: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, defaultMode = 'login', onSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>(defaultMode);
  const [errorMsg, setErrorMsg] = useState('');
  const [login, loginState] = useLoginMutation();
  const [register, registerState] = useRegisterMutation();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg('');
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email')).trim();
    const password = String(form.get('password'));

    try {
      if (mode === 'login') {
        await login({ email, password }).unwrap();
        onSuccess?.('Welcome back! You are now signed in.');
      } else {
        const name = String(form.get('name')).trim();
        await register({ name, email, password }).unwrap();
        onSuccess?.('Account created successfully! Welcome to Common Goods.');
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.data?.error?.message || 'Authentication failed. Please verify your credentials.');
    }
  };

  const handleQuickDemo = async (email: string, pass: string, roleTitle: string) => {
    setErrorMsg('');
    try {
      await login({ email, password: pass }).unwrap();
      onSuccess?.(`Signed in as demo ${roleTitle}!`);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.data?.error?.message || `Quick sign-in for ${roleTitle} failed.`);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
        style={{ width: 'min(100%, 480px)' }}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <div className="eyebrow">
          <span className="eyebrow-line" /> COMMON GOODS PASSPORT
        </div>
        <h2>{mode === 'login' ? 'Welcome back.' : 'Create your account.'}</h2>
        <p style={{ margin: '4px 0 20px', color: '#6b7280', fontSize: 13 }}>
          {mode === 'login'
            ? 'Sign in to access your curated bag, order tracking, and account.'
            : 'Join independent makers and conscious shoppers today.'}
        </p>

        {/* Quick Demo Switcher Section */}
        <div style={{ background: '#f0f5ee', border: '1px solid #d4e2d0', borderRadius: 8, padding: '12px 14px', marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#385536', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            ⚡ Quick Demo Accounts (1-Click Switch)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <button
              type="button"
              onClick={() => handleQuickDemo('customer@fs01.local', 'CustomerDemo!2026', 'Customer')}
              style={{
                background: '#fff',
                border: '1px solid #c7d9c2',
                borderRadius: 6,
                padding: '6px 8px',
                fontSize: 11,
                fontWeight: 600,
                color: '#2d422b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <User size={13} /> Buyer
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo('maker@fs01.local', 'MakerDemo!2026', 'Vendor')}
              style={{
                background: '#fff',
                border: '1px solid #c7d9c2',
                borderRadius: 6,
                padding: '6px 8px',
                fontSize: 11,
                fontWeight: 600,
                color: '#2d422b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <Store size={13} /> Vendor
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo('admin@fs01.local', 'AdminDemo!2026', 'Admin')}
              style={{
                background: '#fff',
                border: '1px solid #c7d9c2',
                borderRadius: 6,
                padding: '6px 8px',
                fontSize: 11,
                fontWeight: 600,
                color: '#99583d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <Shield size={13} /> Admin
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <label>
              Your Name
              <input required name="name" placeholder="Yuvraj Negy" minLength={2} />
            </label>
          )}

          <label>
            Email Address
            <input required name="email" type="email" placeholder="you@domain.com" />
          </label>

          <label>
            Password
            <input
              required
              name="password"
              type="password"
              placeholder="••••••••••••"
              minLength={mode === 'register' ? 8 : 1}
            />
          </label>

          {errorMsg && (
            <p className="form-error" role="alert" style={{ fontSize: 12, color: '#dc2626', margin: '4px 0' }}>
              {errorMsg}
            </p>
          )}

          <button
            className="primary-button auth-submit"
            disabled={loginState.isLoading || registerState.isLoading}
            style={{ marginTop: 12 }}
          >
            {mode === 'login' ? 'Sign In' : 'Create Account'} <ArrowRight size={16} />
          </button>
        </form>

        <p className="auth-switch" style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: '#6b7280' }}>
          {mode === 'login' ? 'New to Common Goods? ' : 'Already have an account? '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setErrorMsg('');
            }}
            style={{ background: 'none', border: 0, color: '#455d46', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
          >
            {mode === 'login' ? 'Create an account' : 'Sign in here'}
          </button>
        </p>
      </section>
    </div>
  );
};
