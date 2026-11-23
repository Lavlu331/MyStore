import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { dateTime } from '../config';
import AccountLayout from '../components/AccountLayout.jsx';
import { Stars } from '../components/Stars.jsx';

const Thumb = ({ src }) => (src
  ? <img src={src} alt="" className="h-16 w-16 shrink-0 rounded border object-cover" />
  : <div className="h-16 w-16 shrink-0 rounded bg-slate-100" />);

export default function MyReviews() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('todo');
  const [error, setError] = useState('');

  useEffect(() => { api('/reviews/mine').then(setData).catch((e) => setError(e.message)); }, []);

  const tabBtn = (key, label, n) => (
    <button onClick={() => setTab(key)} className={`rounded px-4 py-1.5 text-sm ${tab === key ? 'bg-orange-600 font-medium text-white' : 'text-slate-600 hover:bg-orange-50'}`}>
      {label}{n !== undefined ? ` (${n})` : ''}
    </button>
  );

  return (
    <AccountLayout title="My Reviews">
      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      {!data && !error && <p className="py-10 text-center text-slate-500">Loading…</p>}
      {data && (
        <>
          <div className="mb-3 flex gap-1 rounded bg-white p-1">{tabBtn('todo', 'To review', data.toReview.length)}{tabBtn('done', 'History', data.reviews.length)}</div>

          {tab === 'todo' && (
            <div className="divide-y rounded bg-white">
              {data.toReview.map((p) => (
                <div key={p.product_id} className="flex flex-wrap items-center gap-3 p-4">
                  <Thumb src={p.image} />
                  <div className="min-w-0 flex-1"><Link to={`/products/${p.product_id}`} className="line-clamp-2 font-medium hover:text-orange-600">{p.name}</Link><p className="text-xs text-slate-500">From order #{p.order_id}</p></div>
                  <Link to={`/products/${p.product_id}#reviews`} className="rounded bg-orange-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-700">Write a review</Link>
                </div>
              ))}
              {!data.toReview.length && <p className="py-12 text-center text-slate-500">🎉 Nothing waiting. Products from your delivered orders appear here when they need a review.</p>}
            </div>
          )}

          {tab === 'done' && (
            <div className="divide-y rounded bg-white">
              {data.reviews.map((r) => (
                <div key={r.id} className="flex gap-3 p-4">
                  <Thumb src={r.image} />
                  <div className="min-w-0 flex-1">
                    <Link to={`/products/${r.product_id}#reviews`} className="line-clamp-1 font-medium hover:text-orange-600">{r.name}</Link>
                    <div className="mt-0.5 flex items-center gap-2"><Stars value={r.rating} /><span className="text-xs text-slate-400">{dateTime(r.created_at)}</span></div>
                    {r.comment && <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{r.comment}</p>}
                  </div>
                  <Link to={`/products/${r.product_id}#reviews`} className="self-start text-sm text-orange-600 hover:underline">Edit</Link>
                </div>
              ))}
              {!data.reviews.length && <p className="py-12 text-center text-slate-500">You have not written any reviews yet.</p>}
            </div>
          )}
        </>
      )}
    </AccountLayout>
  );
}
