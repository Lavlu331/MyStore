import { BoltIcon, BoxIcon, HeartIcon, LinkIcon, TruckIcon, WalletIcon } from '../components/icons.jsx';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { money } from '../config';
import ProductCard from '../components/ProductCard.jsx';
import Countdown from '../components/Countdown.jsx';
import ProductGallery from '../components/ProductGallery.jsx';
import QuantityInput from '../components/QuantityInput.jsx';
import Reviews from '../components/Reviews.jsx';
import { Stars } from '../components/Stars.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { addRecent } from '../lib/recent.js';
import { useCart } from '../context/CartContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';

const Skeleton = () => (
  <div className="animate-pulse rounded bg-white p-4">
    <div className="grid gap-4 md:grid-cols-[minmax(0,420px)_1fr]">
      <div className="aspect-square rounded bg-slate-200" />
      <div className="space-y-3"><div className="h-6 w-3/4 rounded bg-slate-200" /><div className="h-4 w-1/3 rounded bg-slate-200" /><div className="h-16 rounded bg-slate-200" /><div className="h-10 w-1/2 rounded bg-slate-200" /></div>
    </div>
  </div>
);

export default function ProductDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { refresh } = useCart();
  const { ids, toggle } = useWishlist();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const timer = useRef(null);

  const showToast = (text) => {
    setToast(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(''), 2500);
  };

  useEffect(() => {
    setProduct(null); setError(''); setQty(1);
    window.scrollTo(0, 0);
    api(`/products/${id}`).then(setProduct).catch((e) => setError(e.message));
    api(`/products/${id}/related`).then(setRelated).catch(() => setRelated([]));
  }, [id]);
  useEffect(() => { api('/settings/public').then(setSettings).catch(() => {}); }, []);
  useEffect(() => {
    if (product) document.title = `${product.name} | MyStore`;
    return () => { document.title = 'MyStore'; };
  }, [product]);

  const reload = () => api(`/products/${id}`).then(setProduct).catch(() => {});

  useEffect(() => { if (product) addRecent(product.id); }, [product?.id]);   // eslint-disable-line react-hooks/exhaustive-deps

  // links such as /products/5#reviews should land on the reviews
  useEffect(() => {
    if (product && window.location.hash === '#reviews') setTimeout(() => document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth' }), 150);
  }, [product]);

  const needLogin = () => navigate('/login', { state: { from: `/products/${id}` } });

  const addToCart = async (buyNow = false) => {
    if (!user) return needLogin();
    setBusy(true);
    try {
      await api('/cart/items', { method: 'POST', body: { product_id: product.id, quantity: qty } });
      await refresh();
      if (buyNow) navigate('/cart'); else showToast('Added to cart ✓');
    } catch (e) { showToast(e.message); } finally { setBusy(false); }
  };

  const heart = async () => {
    if (!user) return needLogin();
    try { await toggle(product.id); } catch (e) { showToast(e.message); }
  };

  const share = async () => {
    try { await navigator.clipboard.writeText(window.location.href); showToast('Link copied ✓'); }
    catch { showToast('Copy the address from your browser'); }
  };

  if (error) {
    return (
      <div className="rounded bg-white py-16 text-center">
        <p className="text-lg text-slate-700">{error}</p>
        <Link to="/shop" className="mt-3 inline-block text-orange-600 underline">Back to shop</Link>
      </div>
    );
  }
  if (!product) return <Skeleton />;

  const stock = Number(product.total_stock);
  const inStock = stock > 0;
  const maxQty = Math.min(stock, 99);
  const liked = ids.has(product.id);
  const price = Number(product.final_price);
  const oldPrice = Number(product.price);
  const hasDeal = price < oldPrice;
  const percent = hasDeal ? Math.round((1 - price / oldPrice) * 100) : 0;
  const flashLeft = product.flash_seconds_left;
  const inFlash = flashLeft !== null && flashLeft !== undefined;
  const sold = Number(product.sold) || 0;
  const charge = Number(settings?.delivery_charge || 0);
  const threshold = Number(settings?.free_delivery_threshold || 0);
  const images = product.images.map((i) => i.image_url);

  return (
    <div className="pb-24 md:pb-0">
      <nav className="mb-3 flex flex-wrap items-center gap-1 text-xs text-slate-500">
        <Link to="/" className="hover:text-orange-600">Home</Link><span>›</span>
        <Link to="/shop" className="hover:text-orange-600">Shop</Link><span>›</span>
        {product.category_name && (<><Link to={`/shop?category=${product.category_id}`} className="hover:text-orange-600">{product.category_name}</Link><span>›</span></>)}
        <span className="line-clamp-1 text-slate-700">{product.name}</span>
      </nav>

      <div className="grid gap-5 rounded-2xl border border-violet-100 bg-white p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_13rem] md:grid-cols-2 sm:p-6">
        <ProductGallery images={images} name={product.name} />

        {/* Title, price, buy box */}
        <div>
          <h1 className="text-2xl font-bold leading-tight tracking-tight md:text-3xl">{product.name}</h1>
          <p className="mt-1 text-xs text-slate-500">Item #{product.id}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            {product.rating_count > 0
              ? <><Stars value={product.rating_avg} showNumber /><a href="#reviews" className="text-orange-600 hover:underline">{product.rating_count} review{product.rating_count === 1 ? '' : 's'}</a></>
              : <span>No ratings yet</span>}
            {sold > 0 && <span>| {sold} sold</span>}
            {product.category_name && <span>| {product.category_name}</span>}
          </div>

          {inFlash && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded bg-gradient-to-r from-orange-600 to-red-500 px-3 py-2 text-white">
              <span className="inline-flex items-center gap-1 font-bold"><BoltIcon className="size-4" /> Flash sale</span>
              <span className="flex items-center gap-2 text-sm">Ends in <Countdown seconds={flashLeft} onEnd={reload} tone="light" /></span>
            </div>
          )}
          <div className="mt-3 rounded-xl bg-orange-50 p-4">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-3xl font-bold text-orange-600">{money(price)}</span>
              {hasDeal && <span className="text-base text-slate-400 line-through">{money(oldPrice)}</span>}
              {percent > 0 && <span className="rounded-xl bg-orange-600 px-2 py-0.5 text-xs font-bold text-white">-{percent}%</span>}
            </div>
            {percent > 0 && <p className="mt-1 text-sm text-green-700">You save {money(oldPrice - price)}</p>}
          </div>

          <p className={`mt-3 text-sm font-medium ${inStock ? (stock <= 5 ? 'text-red-600' : 'text-green-700') : 'text-red-600'}`}>
            {inStock ? (stock <= 5 ? `Only ${stock} left in stock` : `In stock (${stock} available)`) : 'Out of stock'}
          </p>

          {inStock && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="text-sm text-slate-600">Quantity</span>
              <QuantityInput value={qty} onChange={setQty} max={maxQty} />
              <span className="text-sm text-slate-500">Total {money(price * qty)}</span>
            </div>
          )}

          <div className="mt-5 hidden flex-wrap gap-3 md:flex">
            <button disabled={!inStock || busy} onClick={() => addToCart(true)}
              className="min-w-0 rounded-xl bg-orange-600 px-6 py-2.5 font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-300">Buy now</button>
            <button disabled={!inStock || busy} onClick={() => addToCart(false)}
              className="min-w-0 rounded-xl border-2 border-orange-600 px-6 py-2.5 font-semibold text-orange-600 hover:bg-orange-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400">Add to cart</button>
          </div>

          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <button onClick={heart} className="flex items-center gap-1.5 text-slate-600 hover:text-orange-600">
              <HeartIcon className={liked ? 'size-5 fill-violet-600 text-violet-600' : 'size-5'} />{liked ? 'In your wishlist' : 'Add to wishlist'}
            </button>
            <button onClick={share} className="flex items-center gap-1.5 text-slate-600 hover:text-orange-600"><LinkIcon className="size-5" />Copy link</button>
          </div>
        </div>

        {/* Delivery & service */}
        <aside className="space-y-3 rounded-xl border border-violet-100 bg-orange-50 p-4 text-sm md:col-span-2 lg:col-span-1">
          <p className="font-semibold text-slate-800">Delivery &amp; service</p>
          <div className="flex gap-2"><TruckIcon className="size-5 shrink-0 text-orange-600" /><div><p className="font-medium">{charge > 0 ? `Delivery charge ${money(charge)}` : 'Free delivery'}</p>
            {charge > 0 && threshold > 0 && <p className="text-xs text-slate-500">Free on orders over {money(threshold)}</p>}</div></div>
          <div className="flex gap-2"><WalletIcon className="size-5 shrink-0 text-orange-600" /><div><p className="font-medium">Cash on delivery</p><p className="text-xs text-slate-500">Pay when your order arrives</p></div></div>
          <div className="flex gap-2"><BoxIcon className="size-5 shrink-0 text-orange-600" /><div><p className="font-medium">Order tracking</p><p className="text-xs text-slate-500">Follow every step in My orders</p></div></div>
          <div className="border-t pt-3"><p className="text-xs text-slate-500">Sold by</p><p className="font-semibold text-orange-600">MyStore</p></div>
        </aside>
      </div>

      <section className="mt-4 rounded-2xl border border-violet-100 bg-white p-4">
        <h2 className="mb-3 border-b pb-2 text-lg font-semibold">Product details</h2>
        <p className="whitespace-pre-line text-slate-700">{product.description || 'No description has been added for this product.'}</p>
      </section>

      <div id="reviews"><Reviews productId={product.id} onChange={reload} /></div>

      {related.length > 0 && (
        <section className="mt-4 rounded-2xl border border-violet-100 bg-white">
          <h2 className="border-b px-4 py-3 text-lg font-semibold text-orange-600">You may also like</h2>
          <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 md:grid-cols-4">
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      {/* Phone: fixed action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex flex-wrap items-center gap-2 border-t bg-white p-2 pb-[max(.5rem,env(safe-area-inset-bottom))] shadow-[0_-2px_8px_rgba(0,0,0,0.08)] md:hidden">
        <div className="w-full px-1 text-sm font-semibold">Total for {qty}: {money(price * qty)}</div>
        <button onClick={heart} aria-label="Wishlist" className="flex h-11 w-11 shrink-0 items-center justify-center rounded border text-xl">
          <HeartIcon className={liked ? 'size-5 fill-violet-600 text-violet-600' : 'size-5'} />
        </button>
        <button disabled={!inStock || busy} onClick={() => addToCart(false)}
          className="h-11 flex-1 rounded-xl border-2 border-orange-600 font-semibold text-orange-600 disabled:border-slate-300 disabled:text-slate-400">{inStock ? 'Add to cart' : 'Out of stock'}</button>
        <button disabled={!inStock || busy} onClick={() => addToCart(true)}
          className="h-11 flex-1 rounded-xl bg-orange-600 font-semibold text-white disabled:bg-slate-300">Buy now</button>
      </div>

      {toast && <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded bg-slate-800 px-4 py-2 text-sm text-white shadow-lg md:bottom-6">{toast}</div>}
    </div>
  );
}
