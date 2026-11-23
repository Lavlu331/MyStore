import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { dateTime, money } from '../config';
import AccountLayout from '../components/AccountLayout.jsx';
import useBuyAgain from '../lib/buyAgain.js';

export const STATUS_STYLE = {
  pending: 'bg-yellow-100 text-yellow-800', confirmed: 'bg-blue-100 text-blue-800',
  processing: 'bg-orange-100 text-orange-800', shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800', cancelled: 'bg-red-100 text-red-800',
  returned: 'bg-slate-200 text-slate-700',
};
export const StatusBadge = ({ status }) => (
  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLE[status] || ''}`}>{status}</span>
);

const IN_PROGRESS = ['pending', 'confirmed', 'processing', 'shipped'];
const TABS = [['', 'All'], ['active', 'In progress'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled'], ['returned', 'Returned']];
const TITLES = { active: 'Track Orders', cancelled: 'My Cancellations', returned: 'My Returns' };

export default function Orders() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const { buyAgain, busyId, error: buyError } = useBuyAgain();

  useEffect(() => { api('/orders').then(setOrders).catch((e) => setError(e.message)); }, []);

  const matches = (o) => !status || (status === 'active' ? IN_PROGRESS.includes(o.status) : o.status === status);
  const shown = (orders || []).filter(matches);
  const count = (key) => (orders || []).filter((o) => (key === 'active' ? IN_PROGRESS.includes(o.status) : o.status === key)).length;

  return (
    <AccountLayout title={TITLES[status] || 'My Orders'}>
      {error && <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      {buyError && <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{buyError}</p>}
      {!orders && !error && <p className="py-10 text-center text-slate-500">Loading…</p>}

      {orders && orders.length === 0 && (
        <div className="rounded-xl bg-white py-14 text-center shadow-sm">
          <p className="text-5xl">📦</p>
          <p className="mt-2 font-semibold">No orders yet</p>
          <Link to="/shop" className="mt-3 inline-block rounded bg-orange-600 px-6 py-2 font-semibold text-white hover:bg-orange-700">Start shopping</Link>
        </div>
      )}

      {orders && orders.length > 0 && (
        <>
          <div className="mb-3 flex gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-sm">
            {TABS.map(([v, label]) => (
              <button key={v} onClick={() => setParams(v ? { status: v } : {})}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${status === v ? 'bg-orange-600 font-medium text-white' : 'text-slate-600 hover:bg-orange-50'}`}>
                {label}{v && count(v) ? <span className="ml-1 text-xs opacity-80">({count(v)})</span> : null}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {shown.map((o) => (
              <div key={o.id} className="overflow-hidden rounded-xl bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-gray-50 px-4 py-2.5 text-sm">
                  <div><span className="font-semibold">Order #{o.id}</span><span className="ml-3 text-xs text-slate-500">Placed on {dateTime(o.created_at)}</span></div>
                  <StatusBadge status={o.status} />
                </div>
                <Link to={`/orders/${o.id}`} className="block divide-y px-4 hover:bg-orange-50/40">
                  {(o.items || []).map((it, i) => (
                    <div key={i} className="flex items-center gap-3 py-3">
                      {it.image ? <img src={it.image} alt="" className="h-16 w-16 shrink-0 rounded-lg border object-cover" /> : <div className="h-16 w-16 shrink-0 rounded-lg bg-slate-100" />}
                      <div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm">{it.product_name}</p><p className="text-xs text-slate-500">Qty: {it.quantity}</p></div>
                    </div>
                  ))}
                  {o.item_count > (o.items || []).reduce((n, it) => n + it.quantity, 0) && <p className="py-2 text-xs text-slate-500">and more items…</p>}
                </Link>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
                  <p className="text-sm text-slate-600">{o.item_count} item{o.item_count === 1 ? '' : 's'} · Total <span className="text-lg font-bold text-orange-600">{money(o.total_amount)}</span></p>
                  <div className="flex flex-wrap gap-2 text-sm">
                    {IN_PROGRESS.includes(o.status) && <Link to={`/orders/${o.id}/track`} className="rounded-lg bg-orange-600 px-4 py-1 text-white hover:bg-orange-700">Track order</Link>}
                    {o.status === 'delivered' && <Link to="/account/reviews" className="rounded-lg border px-3 py-1 hover:bg-gray-50">Write a review</Link>}
                    <button onClick={() => buyAgain(o.id)} disabled={busyId === o.id} className="rounded-lg border border-orange-600 px-3 py-1 font-medium text-orange-600 hover:bg-orange-50 disabled:opacity-50">{busyId === o.id ? 'Adding…' : 'Buy it again'}</button>
                    <Link to={`/orders/${o.id}`} className="rounded-lg border px-3 py-1 hover:bg-gray-50">Details</Link>
                  </div>
                </div>
              </div>
            ))}
            {!shown.length && <p className="rounded-xl bg-white py-10 text-center text-slate-500 shadow-sm">No orders here.</p>}
          </div>
        </>
      )}
    </AccountLayout>
  );
}
