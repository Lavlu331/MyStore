import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import { dateTime, money } from '../../config';
import { Alert, Pager, inputCls } from '../../components/ui.jsx';
import { StatusBadge, STATUS_STYLE } from '../Orders.jsx';

export default function AdminOrders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') || '';
  const search = searchParams.get('search') || '';
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const [draft, setDraft] = useState({ search, from, to });
  const [loading, setLoading] = useState(true);
  const orderLink = (id) => ({ pathname: `/admin/orders/${id}`, search: searchParams.toString() });
  const update = (changes) => {
    const next = new URLSearchParams(searchParams);
    if (!('page' in changes)) next.delete('page');
    Object.entries(changes).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    setSearchParams(next);
  };
  const [data, setData] = useState({ orders: [], total: 0, limit: 20 });
  const [error, setError] = useState('');

  useEffect(() => { setDraft({ search, from, to }); }, [search, from, to]);
  useEffect(() => {
    let current = true;
    setLoading(true); setError('');
    const params = new URLSearchParams({ page, limit: 20 });
    Object.entries({ status, search, from, to }).forEach(([key, value]) => { if (value) params.set(key, value); });
    api(`/orders/manage/all?${params}`)
      .then((result) => { if (current) setData(result); })
      .catch((e) => { if (current) setError(e.message); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [status, page, search, from, to]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Orders</h1>
        <select aria-label="Order status" className={`${inputCls} max-w-[180px]`} value={status} onChange={(e) => update({ status: e.target.value })}>
          <option value="">All statuses</option>
          {Object.keys(STATUS_STYLE).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <form className="mb-3 flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); update({ ...draft, search: draft.search.trim() }); }}>
        <label className="min-w-0 flex-1 basis-full text-sm sm:basis-40">Order or customer
          <input className={inputCls} placeholder="Order number, name or email" value={draft.search} onChange={(e) => setDraft({ ...draft, search: e.target.value })} />
        </label>
        <label className="text-sm">From <input type="date" className={inputCls} value={draft.from} max={draft.to || undefined} onChange={(e) => setDraft({ ...draft, from: e.target.value })} /></label>
        <label className="text-sm">To <input type="date" className={inputCls} value={draft.to} min={draft.from || undefined} onChange={(e) => setDraft({ ...draft, to: e.target.value })} /></label>
        <button className="rounded bg-orange-600 px-4 py-2 text-sm text-white">Search</button>
        <button type="button" className="rounded border bg-white px-4 py-2 text-sm" onClick={() => { setDraft({ search: '', from: '', to: '' }); setSearchParams({}); }}>Clear</button>
      </form>
      <Alert>{error}</Alert>
      {loading && <p role="status" className="py-4 text-sm text-slate-500">Loading orders…</p>}
      {!loading && !error && <>
      <div className="space-y-2 md:hidden">
        {data.orders.map((order) => (
          <article key={order.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-white p-3">
            <div className="min-w-0">
              <h2 className="font-semibold">Order #{order.id}</h2>
              <p className="break-words text-sm text-slate-600">{order.customer_name}</p>
              <p className="text-sm">{money(order.total_amount)}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <StatusBadge status={order.status} />
              <Link to={orderLink(order.id)} aria-label={`Open order ${order.id}`} className="rounded-md bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700">Open</Link>
            </div>
          </article>
        ))}
        {!data.orders.length && <p className="rounded-lg border bg-white p-4 text-center text-sm text-slate-500">No orders found.</p>}
      </div>
      <div className="hidden overflow-x-auto rounded-lg border bg-white md:block">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-slate-50 text-left text-slate-500">
            <th className="px-3 py-2">Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            {data.orders.map((o) => (
              <tr key={o.id} className="border-b last:border-0">
                <td className="px-3 py-2">#{o.id}</td>
                <td>{o.customer_name}<br /><span className="text-xs text-slate-500">{o.customer_email}</span></td>
                <td className="whitespace-nowrap">{dateTime(o.created_at)}</td>
                <td>{money(o.total_amount)}</td>
                <td><StatusBadge status={o.status} /></td>
                <td className="px-3 py-2 text-right"><Link to={orderLink(o.id)} className="text-orange-600 underline">Open</Link></td>
              </tr>
            ))}
            {!data.orders.length && <tr><td colSpan="6" className="p-4 text-center text-slate-500">No orders found.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={data.total} limit={data.limit} onChange={(value) => update({ page: value > 1 ? value : null })} />
      </>}
    </div>
  );
}
