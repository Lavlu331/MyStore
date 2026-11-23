import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { dateTime, money } from '../config';
import AccountLayout from '../components/AccountLayout.jsx';
import OrderTimeline from '../components/OrderTimeline.jsx';
import useBuyAgain from '../lib/buyAgain.js';

const STEPS = [['pending', 'Order placed', '📝'], ['confirmed', 'Confirmed', '✅'], ['processing', 'Packing', '📦'], ['shipped', 'On the way', '🚚'], ['delivered', 'Delivered', '🏠']];

const HEADLINES = {
  pending: ['We received your order', 'We will confirm it shortly. Nothing else is needed from you.'],
  confirmed: ['Your order is confirmed', 'The seller is getting your items ready.'],
  processing: ['We are packing your order', 'Your items are being checked and packed.'],
  shipped: ['Your order is on the way', 'Keep your phone nearby. The delivery person will call you.'],
  delivered: ['Delivered. Enjoy!', 'Your order has arrived. Tell others what you think by writing a review.'],
  cancelled: ['This order was cancelled', 'Any stock and coupon used were released.'],
  returned: ['This order was returned', 'The items were returned to us.'],
};

export default function TrackOrder() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const { buyAgain, busyId, error: buyError } = useBuyAgain();

  useEffect(() => { api(`/orders/${id}`).then(setOrder).catch((e) => setError(e.message)); }, [id]);

  if (!order) return <AccountLayout><p className="py-10 text-center text-slate-500">{error || 'Loading…'}</p></AccountLayout>;

  const idx = STEPS.findIndex(([s]) => s === order.status);
  const [headline, sub] = HEADLINES[order.status] || ['Order status', ''];
  const stamp = (status) => order.history?.find((h) => h.status === status)?.created_at;
  const cashDue = order.payment && order.payment.payment_method === 'cash_on_delivery' && order.payment.status === 'pending' && idx >= 0 && idx < 4;
  const box = 'rounded-xl bg-white p-4 shadow-sm';

  return (
    <AccountLayout>
      <Link to="/orders" className="text-sm text-orange-600 hover:underline">← My orders</Link>

      <section className={`mt-3 rounded-2xl p-5 text-white shadow-lg sm:p-6 ${order.status === 'cancelled' || order.status === 'returned' ? 'bg-gradient-to-br from-slate-700 to-slate-500' : order.status === 'delivered' ? 'bg-gradient-to-br from-green-600 to-emerald-500' : 'bg-gradient-to-br from-orange-600 to-red-500'}`}>
        <p className="text-sm text-white/80">Track order #{order.id} · placed {dateTime(order.created_at)}</p>
        <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">{headline}</h1>
        <p className="mt-1 text-white/90">{sub}</p>
      </section>

      {idx >= 0 && (
        <section className={`${box} mt-3 overflow-x-auto`}>
          <ol className="flex min-w-[34rem]">
            {STEPS.map(([s, label, icon], i) => {
              const done = i <= idx; const current = i === idx;
              return (
                <li key={s} className="relative flex-1 text-center">
                  {i < STEPS.length - 1 && <span className={`absolute left-1/2 top-6 h-1 w-full rounded ${i < idx ? 'bg-orange-500' : 'bg-slate-200'}`} />}
                  <span className={`relative z-10 mx-auto flex h-12 w-12 items-center justify-center rounded-full text-xl ring-4 ring-white ${done ? 'bg-orange-600 text-white' : 'bg-slate-200 grayscale'} ${current ? 'scale-110 shadow-lg shadow-orange-300' : ''}`}>{icon}</span>
                  <span className={`mt-2 block text-sm ${done ? 'font-semibold text-slate-800' : 'text-slate-400'}`}>{label}</span>
                  <span className="block text-[11px] text-slate-400">{stamp(s) ? dateTime(stamp(s)) : '—'}</span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {cashDue && (
        <p className="mt-3 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">💵 Cash on delivery: please keep <strong>{money(order.total_amount)}</strong> ready when your order arrives.</p>
      )}

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_300px]">
        <div className="space-y-3">
          <div className={box}><h2 className="mb-3 font-semibold">Tracking history</h2><OrderTimeline history={order.history} /></div>
          <div className={box}>
            <h2 className="mb-2 font-semibold">Items in this order</h2>
            <div className="divide-y text-sm">
              {order.items.map((i, k) => (
                <div key={k} className="flex items-center justify-between gap-3 py-2">
                  {i.product_id ? <Link to={`/products/${i.product_id}`} className="line-clamp-1 hover:text-orange-600">{i.product_name}</Link> : <span>{i.product_name}</span>}
                  <span className="shrink-0 text-slate-500">× {i.quantity}</span>
                  <span className="shrink-0 font-medium">{money(i.subtotal)}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-right text-lg font-bold text-orange-600">{money(order.total_amount)}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className={box}><h2 className="mb-1 font-semibold">Delivering to</h2><p className="text-sm text-slate-600">{order.street}, {order.city} {order.postal_code}<br />{order.country}<br />Phone: {order.phone}</p></div>
          <div className={box}>
            <h2 className="mb-2 font-semibold">Need something?</h2>
            {buyError && <p className="mb-2 rounded bg-red-50 p-2 text-xs text-red-700">{buyError}</p>}
            <div className="space-y-2 text-sm">
              <button onClick={() => buyAgain(order.id)} disabled={busyId === order.id} className="w-full rounded-lg border border-orange-600 py-2 font-medium text-orange-600 hover:bg-orange-50 disabled:opacity-50">{busyId === order.id ? 'Adding…' : 'Buy it again'}</button>
              <Link to={`/orders/${order.id}`} className="block rounded-lg border py-2 text-center hover:bg-gray-50">Order details{['pending', 'confirmed'].includes(order.status) ? ' / cancel' : ''}</Link>
              <Link to={`/orders/${order.id}/invoice`} className="block rounded-lg border py-2 text-center hover:bg-gray-50">View invoice</Link>
            </div>
          </div>
        </div>
      </div>
    </AccountLayout>
  );
}
