import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { dateTime } from '../config';
import { Alert, btnGhost } from '../components/ui.jsx';

export default function Notifications() {
  const [items, setItems] = useState(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api(`/notifications?limit=50${unreadOnly ? '&unread=true' : ''}`).then(setItems).catch((e) => setError(e.message));
  }, [unreadOnly]);
  useEffect(() => { load(); }, [load]);

  const markRead = async (n) => {
    if (n.is_read) return;
    try { await api(`/notifications/${n.id}/read`, { method: 'PATCH' }); load(); } catch (e) { setError(e.message); }
  };
  const markAll = async () => {
    try { await api('/notifications/read-all', { method: 'PATCH' }); load(); } catch (e) { setError(e.message); }
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Alerts</h1>
        <div className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} /> Unread only
          </label>
          <button onClick={markAll} className={btnGhost}>Mark all as read</button>
        </div>
      </div>
      <Alert>{error}</Alert>
      {!items && <p className="py-8 text-center text-slate-500">Loading…</p>}
      {items && !items.length && <p className="py-8 text-center text-slate-500">No alerts.</p>}
      <div className="divide-y rounded-lg border bg-white">
        {(items || []).map((n) => (
          <button key={n.id} onClick={() => markRead(n)} className={`block w-full p-3 text-left hover:bg-slate-50 ${n.is_read ? '' : 'bg-orange-50'}`}>
            <p className={n.is_read ? 'text-slate-600' : 'font-semibold'}>{n.title}</p>
            <p className="text-sm text-slate-600">{n.message}</p>
            <p className="mt-1 text-xs text-slate-400">{dateTime(n.created_at)}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
