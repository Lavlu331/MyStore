import { useEffect, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { money } from '../config';
import { getCategories } from '../lib/categories.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import Avatar from './Avatar.jsx';
import { BagIcon, BoltIcon, BrandIcon, GridIcon, HeartIcon, SearchIcon, UserIcon } from './icons.jsx';

const STAFF = ['admin', 'inventory_manager'];

export default function Navbar() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const { count: wishCount } = useWishlist();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [q, setQ] = useState('');
  const [catId, setCatId] = useState('');
  const [sugg, setSugg] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const suggestionListId = useId();
  const [cats, setCats] = useState([]);
  const [settings, setSettings] = useState(null);
  const isStaff = user && STAFF.includes(user.role);

  useEffect(() => {
    getCategories().then(setCats).catch(() => {});
    api('/settings/public').then(setSettings).catch(() => {});
  }, []);

  // Staff get an alert counter (checked every 30 seconds)
  useEffect(() => {
    if (!isStaff) { setUnread(0); return; }
    const load = () => api('/notifications/unread-count').then((d) => setUnread(d.unread)).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [isStaff]);

  useEffect(() => {
    setActiveSuggestion(-1);
    setSugg([]);
    if (q.trim().length < 2) return;
    let current = true;
    const timer = setTimeout(() => {
      api(`/products/suggest?q=${encodeURIComponent(q.trim())}`)
        .then((items) => { if (current) setSugg(items); })
        .catch(() => {});
    }, 250);
    return () => { current = false; clearTimeout(timer); };
  }, [q]);

  const suggestionsVisible = open && sugg.length > 0;

  const selectSuggestion = (product) => {
    setOpen(false);
    setQ('');
    navigate(`/products/${product.id}`);
  };

  const handleSearchKeys = (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
      setActiveSuggestion(-1);
    } else if (sugg.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      setOpen(true);
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActiveSuggestion((index) => index < 0 ? (direction > 0 ? 0 : sugg.length - 1) : (index + direction + sugg.length) % sugg.length);
    } else if (event.key === 'Enter' && suggestionsVisible && activeSuggestion >= 0) {
      event.preventDefault();
      selectSuggestion(sugg[activeSuggestion]);
    }
  };

  const search = (e) => {
    e.preventDefault();
    setOpen(false);
    const p = new URLSearchParams();
    if (q.trim()) p.set('search', q.trim());
    if (catId) p.set('category', catId);
    navigate(`/shop${p.toString() ? `?${p}` : ''}`);
  };

  const free = settings && Number(settings.free_delivery_threshold) > 0;

  return (
    <>
      {/* Top strip */}
      <div className="hidden store-utility text-xs print:hidden md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-1.5">
          <span>{free ? `Free delivery on orders over ${money(settings.free_delivery_threshold)}` : 'Cash on delivery available'}</span>
          <div className="flex items-center gap-4">
            {isStaff && <Link to="/admin" className="font-medium text-orange-300 hover:text-white">Admin panel</Link>}
            {user && <Link to="/orders" className="hover:text-white">My orders</Link>}
            {user
              ? <button onClick={() => { logout(); navigate('/'); }} className="hover:text-white">Logout</button>
              : <><Link to="/login" className="hover:text-white">Login</Link><Link to="/register" className="hover:text-white">Sign up</Link></>}
          </div>
        </div>
      </div>

      {/* Main header (stays visible while scrolling) */}
      <div className="sticky top-0 z-30 store-header print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6 md:py-4">
          <Link to="/" className="store-brand"><span aria-hidden="true"><BrandIcon className="size-5" /></span>MyStore</Link>

          <form onSubmit={search} className="store-search relative order-last flex w-full text-slate-800 md:order-none md:w-auto md:flex-1">
            <select value={catId} onChange={(e) => setCatId(e.target.value)}
              className="hidden max-w-[10rem] rounded-l-full border-r border-violet-100 bg-transparent px-3 text-sm md:block" aria-label="Category">
              <option value="">All</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)} onBlur={(event) => { if (!event.relatedTarget?.closest('[role=listbox]')) { setOpen(false); setActiveSuggestion(-1); } }}
              onKeyDown={handleSearchKeys} role="combobox" aria-autocomplete="list" aria-expanded={suggestionsVisible}
              aria-controls={suggestionsVisible ? suggestionListId : undefined}
              aria-activedescendant={suggestionsVisible && activeSuggestion >= 0 ? `${suggestionListId}-${activeSuggestion}` : undefined}
              placeholder="Search products" aria-label="Search products" className="min-w-0 flex-1 px-3 py-2 text-sm outline-none" />
            <button className="store-search-button" aria-label="Search"><SearchIcon className="h-5 w-5" /></button>
            {suggestionsVisible && (
              <ul id={suggestionListId} role="listbox" aria-label="Product suggestions" className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-md border bg-white shadow-lg">
                {sugg.map((s, index) => (
                  <li key={s.id} role="presentation">
                    <Link to={`/products/${s.id}`} role="option" tabIndex={-1}
                      id={`${suggestionListId}-${index}`} aria-selected={activeSuggestion === index}
                      onMouseDown={(event) => event.preventDefault()} onClick={() => { setOpen(false); setQ(''); }}
                      className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-orange-50 aria-selected:bg-orange-100">
                      {s.image ? <img src={s.image} alt="" className="h-9 w-9 rounded object-cover" /> : <span className="h-9 w-9 rounded bg-slate-100" />}
                      <span className="flex-1">{s.name}</span>
                      <span className="font-medium text-orange-600">{money(s.final_price)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </form>

          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <Link to="/wishlist" className="store-header-action relative hidden md:block" aria-label="Wishlist">
              <HeartIcon />
              {wishCount > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-white px-1.5 text-xs font-bold text-orange-700">{wishCount}</span>}
            </Link>
            <Link to="/cart" className="store-header-action relative" aria-label="Cart">
              <BagIcon />
              {count > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-white px-1.5 text-xs font-bold text-orange-700">{count}</span>}
            </Link>

            {/* Account menu (opens on hover on desktop) */}
            <div className="group relative hidden md:block">
              <Link to={user ? '/profile' : '/login'} className="store-header-action flex items-center gap-1.5">
                {user?.avatar_url ? <Avatar user={user} size="h-7 w-7" /> : <UserIcon />}
                <span className="max-w-[7rem] truncate text-sm">{user ? user.name.split(' ')[0] : 'Login'}</span>
                {isStaff && unread > 0 && <span className="rounded-full bg-white px-1.5 text-xs font-bold text-orange-700">{unread}</span>}
              </Link>
              <div className="invisible absolute right-0 top-full z-40 w-52 pt-1 opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                <div className="overflow-hidden rounded-md bg-white py-1 text-sm text-slate-700 shadow-lg">
                  {user ? (
                    <>
                      <Link to="/account" className="block px-4 py-2 font-medium hover:bg-orange-50">Your account</Link>
                      <Link to="/profile" className="block px-4 py-2 hover:bg-orange-50">My profile</Link>
                      <Link to="/orders" className="block px-4 py-2 hover:bg-orange-50">My orders</Link>
                      <Link to="/wishlist" className="block px-4 py-2 hover:bg-orange-50">My wishlist</Link>
                      <Link to="/account/addresses" className="block px-4 py-2 hover:bg-orange-50">Address book</Link>
                      <Link to="/account/vouchers" className="block px-4 py-2 hover:bg-orange-50">My vouchers</Link>
                      <Link to="/account/reviews" className="block px-4 py-2 hover:bg-orange-50">My reviews</Link>
                      {isStaff && <Link to="/admin" className="block px-4 py-2 font-medium text-orange-700 hover:bg-orange-50">Admin panel</Link>}
                      {isStaff && <Link to="/notifications" className="block px-4 py-2 hover:bg-orange-50">Alerts{unread > 0 && <span className="ml-2 rounded-full bg-red-600 px-1.5 text-xs text-white">{unread}</span>}</Link>}
                      <button onClick={() => { logout(); navigate('/'); }} className="block w-full border-t px-4 py-2 text-left hover:bg-orange-50">Logout</button>
                    </>
                  ) : (
                    <>
                      <Link to="/login" className="block px-4 py-2 hover:bg-orange-50">Login</Link>
                      <Link to="/register" className="block px-4 py-2 hover:bg-orange-50">Create account</Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Category bar */}
      <nav aria-label="Shop categories" className="store-category-nav print:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 text-sm sm:px-6">
          <div className="shrink-0">
            <Link to="/shop" className="flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 font-semibold text-orange-700">
              <GridIcon className="h-4 w-4" /> All categories
            </Link>
          </div>
          {cats.slice(0, 8).map((c) => (
            <Link key={c.id} to={`/shop?category=${c.id}`} className="shrink-0 whitespace-nowrap px-3 py-2.5 text-slate-700 hover:text-orange-600">{c.name}</Link>
          ))}
          <span className="mx-1 hidden h-4 w-px shrink-0 bg-slate-200 lg:block" />
          <Link to="/flash-sale" className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap px-3 py-2.5 font-semibold text-orange-700 hover:underline"><BoltIcon className="size-4" /> Flash sale</Link>
          <Link to="/shop?sort=sold_desc" className="hidden shrink-0 whitespace-nowrap px-3 py-2.5 font-medium text-orange-600 hover:underline lg:block">Best sellers</Link>
          <Link to="/shop?sort=rating_desc" className="hidden shrink-0 whitespace-nowrap px-3 py-2.5 font-medium text-orange-600 hover:underline lg:block">Top rated</Link>
          <Link to="/shop?sort=newest" className="hidden shrink-0 whitespace-nowrap px-3 py-2.5 font-medium text-orange-600 hover:underline lg:block">New arrivals</Link>
        </div>
      </nav>
    </>
  );
}
