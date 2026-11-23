import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { money } from '../config';
import OrderSummary, { CouponBox } from '../components/OrderSummary.jsx';
import { Alert, inputCls } from '../components/ui.jsx';
import useQuote from '../lib/useQuote.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';

const STEPS = ['Delivery address', 'Payment', 'Review & place order'];
const LABELS = ['Home', 'Office', 'Other'];

export default function Checkout() {
  const { user, refreshUser } = useAuth();
  const { cart, refresh, status: cartStatus } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  const [step, setStep] = useState(1);
  const [addresses, setAddresses] = useState(null);      // null while loading
  const [addressError, setAddressError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ label: 'Home', phone: user.phone || '', street: user.street || '', city: user.city || '', postal_code: user.postal_code || '', country: user.country || '' });
  const [saveNew, setSaveNew] = useState(true);
  const [address, setAddress] = useState(null);          // the address chosen for this order
  const [payment, setPayment] = useState('cash_on_delivery');
  const [applied, setApplied] = useState(location.state?.coupon || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { quote, couponError } = useQuote(cart.items, applied, () => setApplied(''));

  const loadAddresses = useCallback(() => {
    setAddressError('');
    api('/addresses').then((list) => {
      setAddresses(list);
      const def = list.find((a) => a.is_default) || list[0];
      if (def) setSelectedId(def.id);
      else setAdding(true);
    }).catch(() => setAddressError('Could not load your saved addresses.'));
  }, []);
  useEffect(() => { loadAddresses(); }, [loadAddresses]);

  if (!busy && cartStatus === 'loading') return <p role="status" className="py-10 text-center">Loading your cart…</p>;
  if (!busy && cartStatus === 'error') return (
    <div className="py-10 text-center">
      <p role="alert">Could not load your cart.</p>
      <button type="button" onClick={refresh} className="mt-3 rounded bg-orange-600 px-4 py-2 text-white">Try again</button>
    </div>
  );
  if (!busy && cartStatus === 'ready' && !cart.items.length) return <Navigate to="/cart" replace />;

  const count = cart.items.reduce((s, i) => s + i.quantity, 0);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const toPayment = async (e) => {
    e.preventDefault();
    setError('');
    if (adding) {
      if (!form.street.trim() || !form.city.trim() || !form.phone.trim()) { setError('Street, city and phone number are required'); return; }
      if (saveNew) {
        try {
          await api('/addresses', { method: 'POST', body: { ...form, is_default: !addresses.length } });
          setAddresses(await api('/addresses'));
          refreshUser();
        } catch (err) { setError(err.message); return; }
      }
      setAddress(form);
    } else {
      const a = addresses.find((x) => x.id === selectedId);
      if (!a) { setError('Please choose a delivery address'); return; }
      setAddress(a);
    }
    setStep(2);
  };

  const placeOrder = async () => {
    setError(''); setBusy(true);
    try {
      const order = await api('/orders', {
        method: 'POST',
        body: {
          street: address.street, city: address.city, postal_code: address.postal_code, country: address.country,
          phone: address.phone, payment_method: payment, coupon_code: applied || undefined,
        },
      });
      await refresh();
      navigate(`/orders/${order.order_id}`, { state: { placed: true }, replace: true });
    } catch (err) { setError(err.message); await refresh(); setBusy(false); }
  };

  const card = 'rounded bg-white p-4';

  return (
    <div>
      <h1 className="mb-3 text-xl font-semibold">Checkout</h1>

      <ol className="mb-4 grid grid-cols-3 rounded bg-white p-3">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = step > n;
          return (
            <li key={label} className="flex flex-col items-center gap-1 text-center">
              <button disabled={!done} onClick={() => setStep(n)}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${step === n ? 'bg-orange-600 text-white' : done ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                {done ? '✓' : n}
              </button>
              <span className={`text-[11px] sm:text-xs ${step === n ? 'font-semibold text-slate-800' : 'text-slate-500'}`}>{label}</span>
            </li>
          );
        })}
      </ol>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Alert>{error}</Alert>

          {step === 1 && (
            <div className={`${card} space-y-3`}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Where should we deliver?</h2>
                <Link to="/account/addresses" className="text-sm text-orange-600 hover:underline">Manage address book</Link>
              </div>

              {addressError && <div role="alert" className="space-y-2 py-4"><p>{addressError}</p><button type="button" onClick={loadAddresses} className="store-button store-button-outline">Try again</button></div>}
              {addresses === null && !addressError && <p className="py-6 text-center text-slate-400">Loading your addresses…</p>}

              {addresses !== null && !adding && (
                <form onSubmit={toPayment} className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {addresses.map((a) => (
                      <label key={a.id} className={`flex cursor-pointer gap-3 rounded border p-3 ${selectedId === a.id ? 'border-orange-600 bg-orange-50' : 'hover:border-slate-400'}`}>
                        <input type="radio" name="address" checked={selectedId === a.id} onChange={() => setSelectedId(a.id)} className="mt-1" />
                        <span className="text-sm">
                          <span className="mr-2 rounded bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">{a.label}</span>
                          {a.is_default && <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">DEFAULT</span>}
                          <span className="mt-1 block text-slate-700">{a.street}, {a.city} {a.postal_code}<br />{a.country}<br />Phone: {a.phone || '—'}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <button type="button" onClick={() => setAdding(true)} className="text-sm font-medium text-orange-600 hover:underline">＋ Add a new address</button>
                  <div className="flex justify-between pt-2">
                    <Link to="/cart" className="self-center text-sm text-slate-500 hover:text-orange-600">← Back to cart</Link>
                    <button className="rounded bg-orange-600 px-8 py-2.5 font-semibold text-white hover:bg-orange-700">Deliver to this address</button>
                  </div>
                </form>
              )}

              {addresses !== null && adding && (
                <form onSubmit={toPayment} className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {LABELS.map((l) => (
                      <button type="button" key={l} onClick={() => setForm({ ...form, label: l })}
                        className={`rounded-full border px-4 py-1 text-sm ${form.label === l ? 'border-orange-600 bg-orange-50 font-medium text-orange-700' : 'hover:border-slate-400'}`}>{l}</button>
                    ))}
                  </div>
                  <label className="block text-sm font-medium"><span className="mb-1 block">Street address</span><input required autoComplete="street-address" type="text" className={inputCls} value={form.street} onChange={set('street')} /></label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-medium"><span className="mb-1 block">City</span><input required autoComplete="address-level2" type="text" className={inputCls} value={form.city} onChange={set('city')} /></label>
                    <label className="block text-sm font-medium"><span className="mb-1 block">Postal code</span><input autoComplete="postal-code" type="text" className={inputCls} value={form.postal_code} onChange={set('postal_code')} /></label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-medium"><span className="mb-1 block">Country</span><input autoComplete="country-name" type="text" className={inputCls} value={form.country} onChange={set('country')} /></label>
                    <label className="block text-sm font-medium"><span className="mb-1 block">Phone number</span><input required autoComplete="tel" type="tel" className={inputCls} value={form.phone} onChange={set('phone')} /></label>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" checked={saveNew} onChange={(e) => setSaveNew(e.target.checked)} /> Save this address in my address book
                  </label>
                  <div className="flex justify-between pt-2">
                    {addresses.length > 0
                      ? <button type="button" onClick={() => setAdding(false)} className="self-center text-sm text-slate-500 hover:text-orange-600">← Use a saved address</button>
                      : <Link to="/cart" className="self-center text-sm text-slate-500 hover:text-orange-600">← Back to cart</Link>}
                    <button className="rounded bg-orange-600 px-8 py-2.5 font-semibold text-white hover:bg-orange-700">Continue</button>
                  </div>
                </form>
              )}
            </div>
          )}

          {step === 2 && (
            <div className={`${card} space-y-3`}>
              <h2 className="text-lg font-semibold">Payment method</h2>
              <label className={`flex cursor-pointer items-start gap-3 rounded border p-3 ${payment === 'cash_on_delivery' ? 'border-orange-600 bg-orange-50' : ''}`}>
                <input type="radio" checked={payment === 'cash_on_delivery'} onChange={() => setPayment('cash_on_delivery')} className="mt-1" />
                <span><span className="font-medium">💵 Cash on delivery</span><br /><span className="text-sm text-slate-500">Pay in cash when your order arrives.</span></span>
              </label>
              <label className="flex items-start gap-3 rounded border bg-gray-50 p-3 opacity-60">
                <input type="radio" disabled className="mt-1" />
                <span><span className="font-medium">💳 Online payment</span> <span className="ml-1 rounded bg-slate-200 px-2 py-0.5 text-xs">Coming soon</span><br /><span className="text-sm text-slate-500">Cards and mobile wallets.</span></span>
              </label>
              <div className="flex justify-between pt-2">
                <button onClick={() => setStep(1)} className="text-sm text-slate-500 hover:text-orange-600">← Back</button>
                <button onClick={() => setStep(3)} className="rounded bg-orange-600 px-8 py-2.5 font-semibold text-white hover:bg-orange-700">Continue</button>
              </div>
            </div>
          )}

          {step === 3 && address && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className={card}>
                  <div className="mb-1 flex justify-between"><h3 className="font-semibold">Delivery address</h3><button onClick={() => setStep(1)} className="text-sm text-orange-600 hover:underline">Edit</button></div>
                  <p className="text-sm text-slate-600">{user.name}<br />{address.street}, {address.city} {address.postal_code}<br />{address.country}<br />Phone: {address.phone}</p>
                </div>
                <div className={card}>
                  <div className="mb-1 flex justify-between"><h3 className="font-semibold">Payment</h3><button onClick={() => setStep(2)} className="text-sm text-orange-600 hover:underline">Edit</button></div>
                  <p className="text-sm text-slate-600">💵 Cash on delivery<br /><span className="text-xs text-slate-500">Pay when your order arrives.</span></p>
                </div>
              </div>

              <div className={card}>
                <h3 className="mb-2 font-semibold">Items ({count})</h3>
                <div className="divide-y">
                  {cart.items.map((i) => (
                    <div key={i.product_id} className="flex items-center gap-3 py-2">
                      {i.image ? <img src={i.image} alt="" className="h-14 w-14 rounded border object-cover" /> : <div className="h-14 w-14 rounded bg-slate-100" />}
                      <div className="min-w-0 flex-1"><p className="line-clamp-1 text-sm">{i.name}</p><p className="text-xs text-slate-500">{money(i.unit_price)} × {i.quantity}</p></div>
                      <p className="text-sm font-semibold">{money(i.line_total)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button onClick={() => setStep(2)} className="text-sm text-slate-500 hover:text-orange-600">← Back</button>
                <div className="w-full text-sm font-semibold text-slate-700">Total including delivery: {quote ? money(quote.total) : "Calculating…"}</div>
                <button disabled={busy} onClick={placeOrder} className="rounded bg-orange-600 px-10 py-3 text-lg font-semibold text-white hover:bg-orange-700 disabled:opacity-50">
                  {busy ? 'Placing order…' : 'Place order'}
                </button>
              </div>
            </>
          )}
        </div>

        <OrderSummary quote={quote} itemCount={count}>
          <CouponBox applied={applied} onApply={setApplied} onRemove={() => setApplied('')} error={couponError} />
        </OrderSummary>
      </div>
    </div>
  );
}
