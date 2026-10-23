import { useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Heart, Menu, Search, ShoppingBag, Sparkles, Star, X } from 'lucide-react';
import { useAddAddressMutation, useAddressesQuery, useCartQuery, useCheckoutMutation, useLoginMutation, useMeQuery, useProductsQuery, useRegisterMutation, useUpdateCartMutation } from '../api';
import { formatPrice } from '../utils';

export function App() {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [authOpen, setAuthOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [category, setCategory] = useState('');
  const [cartNotice, setCartNotice] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [notice, setNotice] = useState('');
  const { data, isLoading, isError } = useProductsQuery({ q: search, ...(category ? { category } : {}) });
  const { data: identity } = useMeQuery();
  const signedIn = identity?.user;
  const isCustomer = signedIn?.role === 'CUSTOMER';
  const { data: cartData } = useCartQuery(undefined, { skip: !isCustomer });
  const { data: addressData } = useAddressesQuery(undefined, { skip: !isCustomer || !cartOpen });
  const [login, loginState] = useLoginMutation();
  const [register, registerState] = useRegisterMutation();
  const [updateCart] = useUpdateCartMutation();
  const [addAddress, addAddressState] = useAddAddressMutation();
  const [checkout, checkoutState] = useCheckoutMutation();
  const bagCount = cartData?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const subtotal = cartData?.items.reduce((sum, item) => sum + item.product.pricePaise * item.quantity, 0) ?? 0;

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice('');
    const form = new FormData(event.currentTarget);
    try {
      if (mode === 'login') await login({ email: String(form.get('email')), password: String(form.get('password')) }).unwrap();
      else await register({ name: String(form.get('name')), email: String(form.get('email')), password: String(form.get('password')) }).unwrap();
      setAuthOpen(false); setNotice('You’re signed in. Welcome in.');
    } catch { setNotice('That didn’t work. Check your details and try again.'); }
  }

  async function addProductToCart(productId: string) {
    if (!isCustomer) { setMode('login'); setAuthOpen(true); return; }
    const items = (cartData?.items ?? []).map(item => ({ productId: item.product._id, quantity: item.quantity }));
    const existing = items.find(item => item.productId === productId);
    if (existing) existing.quantity = Math.min(20, existing.quantity + 1); else items.push({ productId, quantity: 1 });
    try { await updateCart({ items }).unwrap(); setNotice('Added to your bag.'); }
    catch { setNotice('That item could not be added right now.'); }
  }

  async function saveAddress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try { await addAddress({ label: 'Home', recipient: String(form.get('recipient')), phone: String(form.get('phone')), line1: String(form.get('line1')), line2: '', city: String(form.get('city')), state: String(form.get('state')), postalCode: String(form.get('postalCode')), country: 'India', isDefault: true }).unwrap(); setCartNotice('Address saved.'); }
    catch { setCartNotice('We couldn’t save that address. Check the details and try again.'); }
  }

  async function placeOrder() {
    const selected = addressData?.items.find(address => address.isDefault) ?? addressData?.items[0];
    if (!selected || !cartData?.items.length) return;
    setCartNotice('');
    try {
      const result = await checkout({ addressId: selected._id, items: cartData.items.map(item => ({ productId: item.product._id, quantity: item.quantity })), idempotencyKey: crypto.randomUUID() }).unwrap();
      setCartNotice(`Order ${result.order._id.slice(-8)} created. Test payment is waiting for a signed local webhook.`);
    } catch { setCartNotice('Checkout could not be completed. Please check stock and your saved address.'); }
  }

  return <div className="site-shell">
    <div className="announcement"><Sparkles size={14}/> Thoughtful things, from independent makers <span className="announcement-link">Meet the makers <ArrowUpRight size={12}/></span></div>
    <header className="header">
      <button className="icon-button mobile-menu" aria-label="Open menu"><Menu/></button>
      <a className="wordmark" href="#top">common<span>goods</span><i>.</i></a>
      <nav className="main-nav"><a href="#shop">Shop all</a><a href="#story">Our story</a><a href="#makers">Makers <ChevronDown size={13}/></a></nav>
      <div className="header-actions"><button className="icon-button search-toggle" aria-label="Search" onClick={() => document.getElementById('product-search')?.focus()}><Search/></button><button className="text-button account-button" onClick={() => setAuthOpen(true)}>{signedIn ? `Hi, ${signedIn.name.split(' ')[0]}` : 'Sign in'}</button><button className="bag-button" onClick={() => isCustomer ? setCartOpen(true) : (setMode('login'), setAuthOpen(true))}><ShoppingBag size={18}/><span>Bag</span><b>{bagCount}</b></button></div>
    </header>
    <main id="top">
      <section className="hero">
        <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line"/> THE GOOD THINGS EDIT · VOL. 04</div><h1>Good things.<br/><em>Good people.</em></h1><p>A considered collection of everyday objects, made with care by people who give a damn.</p><a className="primary-button" href="#shop">Find your good thing <ArrowRight size={16}/></a><div className="hero-footnote"><div className="avatar-stack"><i>J</i><i>M</i><i>A</i></div><span>Small-batch, big-hearted.<br/><b>Made by 120+ independent makers</b></span></div></div>
        <div className="hero-art" aria-label="Curated handmade ceramics and accessories"><div className="hero-note note-top">A little more<br/>meaningful <span>↘</span></div><div className="sun-disc"/><div className="product-sculpture"><div className="vase vase-one"/><div className="vase vase-two"/><div className="book-stack"><i/><i/><i/></div><div className="stem"><i/><i/><i/></div></div><div className="art-caption"><span>OBJECTS WITH A STORY</span><b>Made slowly, loved forever.</b></div><div className="hero-index">01 / 04</div></div>
      </section>
      <section className="trust-strip"><div><span className="trust-icon">✳</span><b>Made with intention</b><span>Thoughtful materials, always</span></div><div><span className="trust-icon">↗</span><b>Good goes around</b><span>Fair pay for the people behind it</span></div><div><span className="trust-icon">♡</span><b>Here for the long run</b><span>Keep-worthy, not throwaway</span></div></section>
      <section className="shop-section" id="shop"><div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> THE GOOD STUFF</div><h2>Things to <em>keep.</em></h2></div><div className="shop-tools"><label className="search-box"><Search size={16}/><input id="product-search" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') setSearch(query); }} placeholder="Find something good"/><button onClick={() => setSearch(query)} aria-label="Search products"><ArrowRight size={15}/></button></label><button className="filter-button">Category <ChevronDown size={14}/></button></div></div>
        <div className="category-pills"><button className={!category ? 'active' : ''} onClick={() => setCategory('')}>All the good stuff</button><button className={category === 'Home' ? 'active' : ''} onClick={() => setCategory('Home')}>Home & living</button><button className={category === 'Accessories' ? 'active' : ''} onClick={() => setCategory('Accessories')}>Wear & carry</button><button className={category === 'Stationery' ? 'active' : ''} onClick={() => setCategory('Stationery')}>Paper things</button></div>
        {isLoading && <div className="loading-state">Gathering good things…</div>}{isError && <div className="empty-state">We couldn’t reach the collection just now. Give it another try in a moment.</div>}
        {!isLoading && !isError && <div className="product-grid">{(data?.items ?? []).map((product, index) => <article className="product-card" key={product._id}><div className={`product-image tone-${index % 4}`}><img src={product.imageUrl} alt={product.name}/><span className="image-tag">{['MAKER PICK','LOW-IMPACT','SMALL BATCH','JUST IN'][index % 4]}</span><button aria-label={`Save ${product.name}`} className="heart-button" onClick={() => setNotice('Sign in to save your favourites.')}><Heart size={17}/></button><button className="quick-add" onClick={() => addProductToCart(product._id)}>Add to bag <ArrowUpRight size={14}/></button></div><div className="product-meta"><span>{product.category} <i>·</i> by Studio North</span><span className="stars"><Star size={12} fill="currentColor"/> {product.ratingAverage.toFixed(1)} ({product.ratingCount})</span></div><div className="product-title-row"><h3>{product.name}</h3><b>{formatPrice(product.pricePaise)}</b></div><p className="product-subtitle">{product.description}</p></article>)}</div>}
        {!isLoading && !isError && data?.items.length === 0 && <div className="empty-state">Nothing here just yet. Try another search.</div>}
        <div className="center-link"><a href="#shop">Explore all good things <ArrowRight size={15}/></a></div>
      </section>
      <section className="maker-banner" id="makers"><div><div className="eyebrow"><span className="eyebrow-line"/> PEOPLE MAKE THE DIFFERENCE</div><h2>Small shops.<br/><em>Big stories.</em></h2><p>Behind every good thing is a person who made it with care. Get to know them, and the little details that make their work special.</p><a className="primary-button" href="#story">Meet our makers <ArrowRight size={16}/></a></div><div className="maker-photo"><div className="maker-orbit">GOOD<br/>PEOPLE <span>✳</span></div><div className="photo-label">STUDIO VISIT · JAIPUR, INDIA</div></div></section>
      <footer id="story"><a className="wordmark" href="#top">common<span>goods</span><i>.</i></a><span>A little more good in the everyday.</span><span>© 2026 Common Goods Marketplace</span></footer>
    </main>
    {notice && <div className="toast" role="status"><Check size={16}/>{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={14}/></button></div>}
    {authOpen && <div className="modal-backdrop" onClick={() => setAuthOpen(false)}><section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title" onClick={event => event.stopPropagation()}><button className="modal-close" onClick={() => setAuthOpen(false)} aria-label="Close"><X/></button><div className="eyebrow"><span className="eyebrow-line"/> A GOOD PLACE TO START</div><h2 id="auth-title">{mode === 'login' ? 'Welcome back.' : 'Come on in.'}</h2><p>Sign in to keep track of the good things you love.</p><form onSubmit={submitAuth}>{mode === 'register' && <label>Your name<input required name="name" autoComplete="name" minLength={2}/></label>}<label>Email address<input required name="email" type="email" autoComplete="email"/></label><label>Password<input required name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'register' ? 10 : 1}/></label>{notice && <p className="form-error" role="alert">{notice}</p>}<button className="primary-button auth-submit" disabled={loginState.isLoading || registerState.isLoading}>{mode === 'login' ? 'Sign in' : 'Create account'} <ArrowRight size={16}/></button></form><p className="auth-switch">{mode === 'login' ? 'New to Common Goods?' : 'Already have an account?'} <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p></section></div>}
    {cartOpen && <div className="modal-backdrop" onClick={() => { setCartOpen(false); setCartNotice(''); }}><section className="auth-modal cart-modal" role="dialog" aria-modal="true" aria-labelledby="cart-title" onClick={event => event.stopPropagation()}><button className="modal-close" onClick={() => setCartOpen(false)} aria-label="Close bag"><X/></button><div className="eyebrow"><span className="eyebrow-line"/> YOUR LITTLE COLLECTION</div><h2 id="cart-title">Your bag.</h2>{cartData?.items.length ? <><div className="cart-items">{cartData.items.map(item => <div className="cart-line" key={item.product._id}><img src={item.product.imageUrl} alt=""/><div><b>{item.product.name}</b><span>{item.quantity} × {formatPrice(item.product.pricePaise)}</span></div><strong>{formatPrice(item.quantity * item.product.pricePaise)}</strong></div>)}</div><div className="cart-subtotal"><span>Subtotal</span><b>{formatPrice(subtotal)}</b></div>{addressData?.items.length ? <div className="saved-address"><b>Delivering to</b><span>{(addressData.items.find(address => address.isDefault) ?? addressData.items[0]).recipient} · {(addressData.items.find(address => address.isDefault) ?? addressData.items[0]).line1}, {(addressData.items.find(address => address.isDefault) ?? addressData.items[0]).city}</span><button className="primary-button auth-submit" disabled={checkoutState.isLoading} onClick={placeOrder}>Continue to test payment <ArrowRight size={16}/></button></div> : <form className="address-form" onSubmit={saveAddress}><p>Add a delivery address to continue.</p><label>Name<input name="recipient" required minLength={2}/></label><label>Phone<input name="phone" required/></label><label>Street address<input name="line1" required minLength={3}/></label><div className="address-pair"><label>City<input name="city" required/></label><label>State<input name="state" required/></label></div><label>Postal code<input name="postalCode" required/></label><button className="primary-button auth-submit" disabled={addAddressState.isLoading}>Save address <ArrowRight size={16}/></button></form>}{cartNotice && <p className="cart-notice" role="status">{cartNotice}</p>}</> : <div className="empty-state">{cartNotice || 'Your bag is waiting for something lovely.'}</div>}</section></div>}
  </div>;
}
