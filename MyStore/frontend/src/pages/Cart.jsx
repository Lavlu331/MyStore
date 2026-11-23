import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { money } from '../config';
import OrderSummary, { CouponBox } from '../components/OrderSummary.jsx';
import useQuote from '../lib/useQuote.js';
import { useCart } from '../context/CartContext.jsx';

export default function Cart() {
  const { cart, refresh, status } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [applied, setApplied] = useState('');
  const { quote, couponError } = useQuote(cart.items, applied, () => setApplied(''));

  const run = async (fn) => {
    setPending(true);
    setError('');
    try { await fn(); await refresh(); } catch (e) { setError(e.message); } finally { setPending(false); }
  };
  const setQty = (item, quantity) => run(() => api(`/cart/items/${item.product_id}`, { method: 'PUT', body: { quantity } }));
  const remove = (item) => run(() => api(`/cart/items/${item.product_id}`, { method: 'DELETE' }));
  const clear = () => { if (window.confirm('Remove all items from your cart?')) run(() => api('/cart', { method: 'DELETE' })); };

  if (status === 'loading' && !pending) return <p role="status" className="py-10 text-center">Loading your cart…</p>;
  if (status === 'error') return (
    <div className="py-10 text-center">
      <p role="alert">Could not load your cart.</p>
      <button type="button" onClick={refresh} className="store-button store-button-outline mt-3">Try again</button>
    </div>
  );

  if (!cart.items.length && !pending) {
    return (
      <div className="rounded bg-white py-16 text-center">
        <p className="text-5xl">🛒</p>
        <p className="mt-3 text-lg font-semibold">Your cart is empty</p>
        <p className="text-sm text-slate-500">Add some products and they will show up here.</p>
        <Link to="/shop" className="mt-4 inline-block rounded bg-orange-600 px-6 py-2.5 font-semibold text-white hover:bg-orange-700">Continue shopping</Link>
      </div>
    );
  }

  const count = cart.items.reduce((s, i) => s + i.quantity, 0);
  const problem = cart.items.find((i) => !i.is_active || i.quantity > i.available_stock);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <section className="rounded bg-white">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h1 className="text-lg font-semibold">Shopping cart <span className="text-sm font-normal text-slate-500">({count} item{count === 1 ? '' : 's'})</span></h1>
          <button onClick={clear} disabled={pending} className="text-sm text-red-600 hover:underline">Clear cart</button>
        </div>
        {error && <p className="m-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        {location.state?.notice && <p className="m-3 rounded bg-green-50 p-2 text-sm text-green-800">{location.state.notice}</p>}
        <div className="divide-y">
          {cart.items.map((i) => {
            const bad = !i.is_active || i.quantity > i.available_stock;
            return (
              <div key={i.product_id} className="flex flex-wrap gap-3 p-4 sm:flex-nowrap">
                <Link to={`/products/${i.product_id}`} className="shrink-0">
                  {i.image ? <img src={i.image} alt="" className="size-16 rounded sm:size-24 border object-cover" /> : <div className="size-16 rounded sm:size-24 bg-slate-100" />}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link to={`/products/${i.product_id}`} className="line-clamp-2 font-medium hover:text-orange-600">{i.name}</Link>
                  <p className="mt-1">
                    <span className="font-semibold text-orange-600">{money(i.unit_price)}</span>
                    {Number(i.unit_price) < Number(i.price) && <span className="ml-2 text-xs text-slate-400 line-through">{money(i.price)}</span>}
                  </p>
                  {!i.is_active && <p className="mt-1 text-sm font-medium text-red-600">This product is no longer available. Please remove it.</p>}
                  {i.is_active && i.quantity > i.available_stock && (
                    <p className="mt-1 text-sm font-medium text-red-600">Only {i.available_stock} available. Please reduce the quantity.</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2 sm:gap-3">
                    <div className="inline-flex shrink-0 items-center overflow-hidden rounded border">
                      <button onClick={() => setQty(i, i.quantity - 1)} disabled={pending} className="size-11 hover:bg-slate-100 disabled:opacity-40" aria-label={`Decrease ${i.name} quantity`}>−</button>
                      <span className="w-10 text-center text-sm">{i.quantity}</span>
                      <button onClick={() => setQty(i, i.quantity + 1)} disabled={pending || !i.is_active || i.quantity >= i.available_stock} className="size-11 hover:bg-slate-100 disabled:opacity-40" aria-label={`Increase ${i.name} quantity`}>+</button>
                    </div>
                    <button onClick={() => remove(i)} disabled={pending} className="text-sm text-slate-500 hover:text-red-600">🗑 Remove</button>
                  </div>
                </div>
                <p className="w-full shrink-0 text-right font-semibold sm:w-24">{money(i.line_total)}</p>
              </div>
            );
          })}
        </div>
      </section>

      <OrderSummary quote={quote} itemCount={count}>
        <CouponBox applied={applied} onApply={setApplied} onRemove={() => setApplied('')} error={couponError} />
        <button disabled={Boolean(problem) || pending} onClick={() => navigate('/checkout', { state: { coupon: applied } })}
          className="w-full rounded bg-orange-600 py-3 font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-300">
          Proceed to checkout
        </button>
        <Link to="/shop" className="block text-center text-sm text-orange-600 hover:underline">← Continue shopping</Link>
      </OrderSummary>
    </div>
  );
}
