import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import Countdown from '../components/Countdown.jsx';
import ProductCard from '../components/ProductCard.jsx';

export default function FlashSale() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api('/flash-sales/active?limit=60').then(setData).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (error) return <p className="rounded bg-red-50 p-3 text-red-700">{error}</p>;
  if (!data) return <p className="py-10 text-center text-slate-500">Loading…</p>;

  if (!data.sale) {
    return (
      <div className="rounded bg-white py-16 text-center">
        <p className="text-5xl">⚡</p>
        <p className="mt-2 text-lg font-semibold">No flash sale right now</p>
        {data.upcoming && (
          <p className="mt-3 text-slate-600">“{data.upcoming.title}” starts in <Countdown seconds={data.upcoming.seconds_until_start} onEnd={load} /></p>
        )}
        <Link to="/shop" className="mt-4 inline-block rounded bg-orange-600 px-6 py-2 font-semibold text-white hover:bg-orange-700">Browse the shop</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded bg-gradient-to-r from-orange-600 to-red-500 px-5 py-4 text-white">
        <h1 className="text-2xl font-extrabold">⚡ {data.sale.title}</h1>
        <div className="flex items-center gap-2 text-sm">Ends in <Countdown seconds={data.sale.seconds_left} onEnd={load} tone="light" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {data.products.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </div>
  );
}
