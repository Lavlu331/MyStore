import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api } from '../../api';
import { dateTime, money } from '../../config';
import { Alert, btn, btnGhost, inputCls } from '../../components/ui.jsx';
import OrderTimeline from '../../components/OrderTimeline.jsx';
import OrderTotals from '../../components/OrderTotals.jsx';
import { StatusBadge } from '../Orders.jsx';

// Same rules as the backend (the backend enforces them too)
const NEXT = {
  pending: ['confirmed', 'cancelled'], confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'], shipped: ['delivered', 'returned'],
  delivered: ['returned'], cancelled: [], returned: [],
};

export default function AdminOrderDetail() {
  const { id } = useParams();
  const { search } = useLocation();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingStatus, setPendingStatus] = useState('');
  const [note, setNote] = useState('');

  const load = () => api(`/orders/${id}`).then(setOrder).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id]);

  const change = async (status) => {
    setBusy(true); setError('');
    try { await api(`/orders/${id}/status`, { method: 'PATCH', body: { status, note: note.trim() || undefined } });
      setNote(''); setPendingStatus(''); await load(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  if (!order) return <p className="py-10 text-center text-slate-500">{error || 'Loading…'}</p>;

  return (
    <div>
      <Link to={{ pathname: '/admin/orders', search }} className="text-sm text-orange-600 underline">← Orders</Link>
      <div className="mt-3 rounded-lg border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">Order #{order.id}</h1>
          <StatusBadge status={order.status} />
        </div>
        <p className="text-sm text-slate-500">Placed {dateTime(order.created_at)} · Customer ID {order.user_id}</p>
        <Link to={`/orders/${order.id}/invoice`} className="text-sm text-orange-600 underline">View / print invoice</Link>
        <Alert>{error}</Alert>

        <input placeholder="Optional note for the customer (shown in the timeline)" className={`${inputCls} mt-4 max-w-md`} value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-500">Move to:</span>
          {NEXT[order.status].length === 0 && <span className="text-sm text-slate-400">No further changes possible</span>}
          {NEXT[order.status].map((s) => (
            <button key={s} disabled={busy} onClick={() => ['cancelled', 'returned'].includes(s) ? setPendingStatus(s) : change(s)}
              className={['cancelled', 'returned'].includes(s) ? btnGhost : btn}>{s}</button>
          ))}
        </div>

        {pendingStatus && <section aria-label="Confirm order status" className="mt-3 space-y-2 rounded border border-orange-200 bg-orange-50 p-3">
          <p className="font-medium">Mark this order as {pendingStatus}?</p>
          <p className="text-sm">Items will be returned to stock. {pendingStatus === 'cancelled'
            ? 'Pending payment records will be marked failed and any coupon use will be released.'
            : 'Completed payment records will be marked refunded. Handle any actual refund separately.'}</p>
          <div className="flex gap-2">
            <button disabled={busy} className={btn} onClick={() => change(pendingStatus)}>{pendingStatus === 'cancelled' ? 'Confirm cancellation' : 'Confirm return'}</button>
            <button disabled={busy} className={btnGhost} onClick={() => setPendingStatus('')}>Keep current status</button>
          </div>
        </section>}

        <table className="mt-4 w-full text-sm">
          <thead><tr className="border-b text-left text-slate-500"><th className="py-2">Product</th><th>Price</th><th>Qty</th><th className="text-right">Subtotal</th></tr></thead>
          <tbody>
            {order.items.map((i, idx) => (
              <tr key={idx} className="border-b"><td className="py-2">{i.product_name}</td><td>{money(i.price)}</td><td>{i.quantity}</td><td className="text-right">{money(i.subtotal)}</td></tr>
            ))}
          </tbody>
        </table>
        <OrderTotals order={order} />

        <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div><h2 className="font-medium">Deliver to</h2>
            <p className="text-slate-600">{order.street}, {order.city} {order.postal_code}<br />{order.country}<br />{order.phone}</p></div>
          <div><h2 className="font-medium">Payment</h2>
            <p className="text-slate-600">{order.payment ? `${order.payment.payment_method.replaceAll('_', ' ')} — ${order.payment.status}` : '—'}</p></div>
        </div>

        <div className="mt-6">
          <h2 className="mb-3 font-medium">Order progress</h2>
          <OrderTimeline history={order.history} />
        </div>
      </div>
    </div>
  );
}
