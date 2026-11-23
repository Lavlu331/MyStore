import { useState } from 'react';
import { money } from '../config';

export function CouponBox({ applied, onApply, onRemove, error }) {
  const [input, setInput] = useState('');
  return (
    <div className="rounded bg-gray-50 p-3">
      <p className="mb-2 text-sm font-medium">Coupon code</p>
      {applied ? (
        <p className="flex items-center justify-between text-sm">
          <span className="font-semibold text-green-700">✓ {applied} applied</span>
          <button type="button" onClick={() => { onRemove(); setInput(''); }} className="text-red-600 hover:underline">Remove</button>
        </p>
      ) : (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (input.trim()) onApply(input.trim().toUpperCase()); }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Enter code" className="min-w-0 flex-1 rounded border bg-white p-2 text-sm uppercase" />
          <button className="rounded bg-slate-800 px-4 text-sm font-medium text-white hover:bg-slate-700">Apply</button>
        </form>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

// The price box shown next to the cart and checkout
export default function OrderSummary({ quote, itemCount, children }) {
  if (!quote) return <aside className="h-fit rounded bg-white p-4 text-sm text-slate-500">Calculating…</aside>;
  const left = Number(quote.free_delivery_threshold) - (Number(quote.subtotal) - Number(quote.discount));
  return (
    <aside className="h-fit space-y-3 rounded bg-white p-4 lg:sticky lg:top-24">
      <h2 className="text-lg font-semibold">Order summary</h2>
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between"><span className="text-slate-600">Subtotal{itemCount ? ` (${itemCount} item${itemCount === 1 ? '' : 's'})` : ''}</span><span>{money(quote.subtotal)}</span></div>
        {Number(quote.discount) > 0 && <div className="flex justify-between text-green-700"><span>Discount{quote.coupon_code ? ` (${quote.coupon_code})` : ''}</span><span>-{money(quote.discount)}</span></div>}
        <div className="flex justify-between"><span className="text-slate-600">Delivery</span><span>{Number(quote.delivery) > 0 ? money(quote.delivery) : 'Free'}</span></div>
        {Number(quote.delivery) > 0 && Number(quote.free_delivery_threshold) > 0 && left > 0 && (
          <p className="rounded bg-orange-50 p-2 text-xs text-orange-700">Add {money(left)} more to get free delivery.</p>
        )}
      </div>
      <div className="flex items-baseline justify-between border-t pt-3">
        <span className="font-semibold">Total</span>
        <span className="text-2xl font-bold text-orange-600">{money(quote.total)}</span>
      </div>
      {children}
    </aside>
  );
}
