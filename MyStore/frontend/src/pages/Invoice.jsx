import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { dateTime, money } from '../config';
import OrderTotals from '../components/OrderTotals.jsx';

export default function Invoice() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api(`/orders/${id}`).then(setOrder).catch((e) => setError(e.message)); }, [id]);

  if (error) return <p className="py-10 text-center text-red-600">{error}</p>;
  if (!order) return <p className="py-10 text-center text-slate-500">Loading…</p>;

  return (
    <div>
      <div className="mx-auto mb-3 flex max-w-3xl items-center justify-between print:hidden">
        <Link to={`/orders/${order.id}`} className="text-sm text-orange-600 underline">← Back to order</Link>
        <button onClick={() => window.print()} className="rounded bg-orange-600 px-4 py-2 text-sm text-white hover:bg-orange-700">
          Print / Save as PDF
        </button>
      </div>

      <div className="mx-auto max-w-3xl rounded-lg border bg-white p-8 print:max-w-none print:border-0 print:p-0">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
          <div>
            <p className="text-2xl font-bold text-orange-600">MyStore</p>
            <p className="text-sm text-slate-500">Thank you for shopping with us.</p>
          </div>
          <div className="text-right text-sm">
            <p className="text-xl font-semibold">INVOICE</p>
            <p>Invoice no: <span className="font-medium">INV-{String(order.id).padStart(5, '0')}</span></p>
            <p>Date: {dateTime(order.created_at)}</p>
            <p className="capitalize">Order status: {order.status}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="font-medium">Billed and shipped to</p>
            <p className="text-slate-600">
              {order.customer_name}<br />
              {order.street}, {order.city} {order.postal_code}<br />
              {order.country}<br />Phone: {order.phone}
            </p>
          </div>
          <div>
            <p className="font-medium">Payment</p>
            <p className="capitalize text-slate-600">
              {order.payment ? `${order.payment.payment_method.replaceAll('_', ' ')} (${order.payment.status})` : '—'}
            </p>
          </div>
        </div>

        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th className="py-2">Item</th><th>Price</th><th>Qty</th><th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((i, idx) => (
              <tr key={idx} className="border-b">
                <td className="py-2">{i.product_name}</td><td>{money(i.price)}</td><td>{i.quantity}</td>
                <td className="text-right">{money(i.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <OrderTotals order={order} />
        <p className="mt-8 border-t pt-3 text-center text-xs text-slate-400">This is a computer-generated invoice.</p>
      </div>
    </div>
  );
}
