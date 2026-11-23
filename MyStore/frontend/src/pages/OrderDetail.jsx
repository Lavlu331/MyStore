import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api } from '../api';
import { dateTime, money } from '../config';
import AccountLayout from '../components/AccountLayout.jsx';
import OrderTimeline from '../components/OrderTimeline.jsx';
import useBuyAgain from '../lib/buyAgain.js';
import OrderTotals from '../components/OrderTotals.jsx';
import { StatusBadge } from './Orders.jsx';

const FLOW = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

// Horizontal progress bar: Pending -> Confirmed -> Processing -> Shipped -> Delivered
function Progress({ status }) {
  const idx = FLOW.indexOf(status);
  if (idx < 0) {
    return <div className={`rounded p-3 text-sm ${status === 'cancelled' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-700'}`}>This order was {status}.</div>;
  }
  return (
    <ol className="flex">
      {FLOW.map((s, i) => (
        <li key={s} className="relative flex-1 text-center">
          {i < FLOW.length - 1 && <span className={`absolute left-1/2 top-3.5 h-0.5 w-full ${i < idx ? 'bg-orange-600' : 'bg-slate-200'}`} />}
          <span className={`relative z-10 mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${i <= idx ? 'bg-orange-600 text-white' : 'bg-slate-200 text-slate-500'}`}>{i < idx ? '✓' : i + 1}</span>
          <span className={`mt-1 block text-[11px] capitalize sm:text-xs ${i <= idx ? 'font-medium text-slate-800' : 'text-slate-400'}`}>{s}</span>
        </li>
      ))}
    </ol>
  );
}

export default function OrderDetail() {
  const { id } = useParams();
  const location = useLocation();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { buyAgain, busyId, error: buyError } = useBuyAgain();

  const load = () => api(`/orders/${id}`).then(setOrder).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id]);

  const cancel = async () => {
    if (!window.confirm('Cancel this order?')) return;
    setBusy(true); setError('');
    try { await api(`/orders/${id}/cancel`, { method: 'POST' }); await load(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  if (!order) return <AccountLayout><p className="py-10 text-center text-slate-500">{error || 'Loading…'}</p></AccountLayout>;
  const canCancel = ['pending', 'confirmed'].includes(order.status);
  const box = 'rounded bg-white p-4';

  return (
    <AccountLayout>
      <Link to="/orders" className="text-sm text-orange-600 hover:underline">← My orders</Link>

      {location.state?.placed && (
        <div className="mt-3 rounded border border-green-200 bg-green-50 p-4 text-green-800">
          <p className="text-lg font-semibold">🎉 Thank you! Your order has been placed.</p>
          <p className="text-sm">Order #{order.id} is waiting for confirmation. You will pay {money(order.total_amount)} in cash on delivery.</p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Order #{order.id}</h1>
          <p className="text-sm text-slate-500">Placed on {dateTime(order.created_at)}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={order.status} />
          <Link to={`/orders/${order.id}/track`} className="rounded bg-orange-600 px-3 py-1 text-sm text-white hover:bg-orange-700">Track order</Link>
          <button onClick={() => buyAgain(order.id)} disabled={busyId === order.id} className="rounded border border-orange-600 px-3 py-1 text-sm text-orange-600 hover:bg-orange-50 disabled:opacity-50">{busyId === order.id ? 'Adding…' : 'Buy it again'}</button>
          <Link to={`/orders/${order.id}/invoice`} className="rounded border px-3 py-1 text-sm hover:bg-white">Invoice</Link>
        </div>
      </div>
      {(error || buyError) && <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-700">{error || buyError}</p>}

      <div className={`${box} mt-3`}><Progress status={order.status} /></div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_300px]">
        <div className="space-y-3">
          <div className={box}>
            <h2 className="mb-2 font-semibold">Items</h2>
            <div className="divide-y">
              {order.items.map((i, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    {i.product_id ? <Link to={`/products/${i.product_id}`} className="line-clamp-2 hover:text-orange-600">{i.product_name}</Link> : <span>{i.product_name}</span>}
                    <p className="text-xs text-slate-500">{money(i.price)} × {i.quantity}</p>
                    {order.status === 'delivered' && i.product_id && <Link to={`/products/${i.product_id}#reviews`} className="text-xs font-medium text-orange-600 hover:underline">Write a review</Link>}
                  </div>
                  <span className="font-semibold">{money(i.subtotal)}</span>
                </div>
              ))}
            </div>
            <OrderTotals order={order} />
          </div>
          <div className={box}>
            <h2 className="mb-3 font-semibold">Order progress</h2>
            <OrderTimeline history={order.history} />
          </div>
        </div>

        <div className="space-y-3">
          <div className={box}>
            <h2 className="mb-1 font-semibold">Delivery address</h2>
            <p className="text-sm text-slate-600">{order.street}, {order.city} {order.postal_code}<br />{order.country}<br />Phone: {order.phone}</p>
          </div>
          <div className={box}>
            <h2 className="mb-1 font-semibold">Payment</h2>
            {order.payment
              ? <p className="text-sm capitalize text-slate-600">{order.payment.payment_method.replaceAll('_', ' ')}<br /><span className="text-xs text-slate-500">Status: {order.payment.status}</span></p>
              : <p className="text-sm text-slate-600">—</p>}
          </div>
          {canCancel && (
            <button onClick={cancel} disabled={busy} className="w-full rounded border border-red-300 bg-white py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">Cancel order</button>
          )}
        </div>
      </div>
    </AccountLayout>
  );
}
