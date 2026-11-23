import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { money } from '../config';
import AccountLayout from '../components/AccountLayout.jsx';

const worth = (c) => (c.discount_type === 'percent' ? `${Number(c.discount_value)}%` : money(c.discount_value));

export default function Vouchers() {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => { api('/coupons/available').then(setList).catch((e) => setError(e.message)); }, []);

  const copy = async (code) => {
    try { await navigator.clipboard.writeText(code); setCopied(code); setTimeout(() => setCopied(''), 2000); } catch { setCopied(''); }
  };

  return (
    <AccountLayout title="My Vouchers">
      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      {!list && !error && <p className="py-10 text-center text-slate-500">Loading…</p>}
      {list && !list.length && (
        <div className="rounded bg-white py-14 text-center">
          <p className="text-5xl">🏷️</p>
          <p className="mt-2 font-semibold">No vouchers available right now</p>
          <p className="text-sm text-slate-500">Check back soon. New offers appear here.</p>
        </div>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {(list || []).map((c) => (
          <div key={c.id} className={`flex overflow-hidden rounded bg-white shadow-sm ${c.can_use ? '' : 'opacity-60'}`}>
            <div className="flex w-28 shrink-0 flex-col items-center justify-center bg-gradient-to-b from-orange-500 to-red-500 p-3 text-center text-white">
              <span className="text-2xl font-extrabold leading-tight">{worth(c)}</span><span className="text-xs font-semibold">OFF</span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col p-3">
              <p className="font-mono text-lg font-bold tracking-wide">{c.code}</p>
              {c.description && <p className="text-sm text-slate-600">{c.description}</p>}
              <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
                {Number(c.min_order_amount) > 0 && <li>Minimum spend {money(c.min_order_amount)}</li>}
                {c.discount_type === 'percent' && c.max_discount !== null && <li>Up to {money(c.max_discount)} off</li>}
                <li>{c.expires_at ? `Valid until ${c.expires_at}` : 'No expiry date'}</li>
              </ul>
              <div className="mt-auto flex items-center gap-2 pt-2">
                {c.can_use ? (
                  <>
                    <button onClick={() => copy(c.code)} className="rounded border border-orange-600 px-3 py-1 text-sm font-medium text-orange-600 hover:bg-orange-50">{copied === c.code ? 'Copied ✓' : 'Copy code'}</button>
                    <Link to="/cart" className="text-sm text-slate-500 hover:text-orange-600">Use in cart ›</Link>
                  </>
                ) : <span className="rounded bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">ALREADY USED</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </AccountLayout>
  );
}
