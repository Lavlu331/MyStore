import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { dateTime } from '../config';
import { Alert, btn, btnGhost, inputCls } from './ui.jsx';
import { StarInput, Stars } from './Stars.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Reviews({ productId, onChange }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState({ can_review: false, my_review: null });
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ rating: 0, comment: '' });
  const [msg, setMsg] = useState({ type: 'ok', text: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api(`/reviews/product/${productId}?page=${page}`).then(setData).catch((e) => setMsg({ type: 'error', text: e.message }));
    if (user) {
      api(`/reviews/status/${productId}`).then((s) => {
        setStatus(s);
        if (s.my_review) setForm({ rating: s.my_review.rating, comment: s.my_review.comment || '' });
      }).catch(() => {});
    }
  }, [productId, page, user]);
  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.rating) { setMsg({ type: 'error', text: 'Please choose a star rating' }); return; }
    setBusy(true); setMsg({ type: 'ok', text: '' });
    try {
      await api(`/reviews/product/${productId}`, { method: 'POST', body: form });
      setMsg({ type: 'ok', text: 'Thank you! Your review has been saved.' });
      load(); onChange?.();
    } catch (err) { setMsg({ type: 'error', text: err.message }); } finally { setBusy(false); }
  };

  const remove = async (id, own) => {
    if (!window.confirm('Delete this review?')) return;
    try {
      await api(`/reviews/${id}`, { method: 'DELETE' });
      if (own) setForm({ rating: 0, comment: '' });
      load(); onChange?.();
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  };

  if (!data) return null;
  const { summary } = data;

  return (
    <section className="mt-10 rounded-lg border bg-white p-4">
      <h2 className="mb-4 text-xl font-semibold">Customer reviews</h2>

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <div>
          {summary.count === 0 ? <p className="text-slate-500">No reviews yet.</p> : (
            <>
              <p className="text-4xl font-bold">{summary.average.toFixed(1)}<span className="text-lg font-normal text-slate-400"> / 5</span></p>
              <Stars value={summary.average} count={summary.count} />
              <div className="mt-3 space-y-1">
                {[5, 4, 3, 2, 1].map((n) => (
                  <div key={n} className="flex items-center gap-2 text-xs">
                    <span className="w-3">{n}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded bg-slate-100">
                      <div className="h-full bg-amber-500" style={{ width: `${(summary.distribution[n] / summary.count) * 100}%` }} />
                    </div>
                    <span className="w-6 text-right text-slate-500">{summary.distribution[n]}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div>
          {/* Write or edit a review */}
          {!user && <p className="mb-4 rounded bg-slate-50 p-3 text-sm text-slate-600"><Link to="/login" className="text-orange-600 underline">Log in</Link> to review products you have received.</p>}
          {user && !status.can_review && !status.my_review && (
            <p className="mb-4 rounded bg-slate-50 p-3 text-sm text-slate-600">You can review this product after an order containing it has been delivered.</p>
          )}
          {user && (status.can_review || status.my_review) && (
            <form onSubmit={submit} className="mb-5 space-y-2 rounded-lg bg-slate-50 p-3">
              <p className="font-medium">{status.my_review ? 'Edit your review' : 'Write a review'}</p>
              <Alert type={msg.type}>{msg.text}</Alert>
              <StarInput value={form.rating} onChange={(rating) => setForm({ ...form, rating })} />
              <textarea rows="3" maxLength="1000" placeholder="Share your experience (optional)" className={inputCls}
                value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
              <div className="space-x-2">
                <button disabled={busy} className={btn}>{status.my_review ? 'Update review' : 'Submit review'}</button>
                {status.my_review && <button type="button" onClick={() => remove(status.my_review.id, true)} className={btnGhost}>Delete</button>}
              </div>
            </form>
          )}

          {/* Review list */}
          <div className="divide-y">
            {data.reviews.map((r) => (
              <div key={r.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2"><Stars value={r.rating} /><span className="text-sm font-medium">{r.reviewer}</span></div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    {dateTime(r.created_at)}
                    {user?.role === 'admin' && <button onClick={() => remove(r.id, false)} className="text-red-600 hover:underline">Remove</button>}
                  </div>
                </div>
                {r.comment && <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{r.comment}</p>}
              </div>
            ))}
          </div>

          {data.totalPages > 1 && (
            <div className="mt-3 flex items-center justify-center gap-3 text-sm">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className={btnGhost}>Previous</button>
              <span>Page {page} of {data.totalPages}</span>
              <button disabled={page >= data.totalPages} onClick={() => setPage(page + 1)} className={btnGhost}>Next</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
