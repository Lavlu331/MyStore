import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { dateTime } from '../../config';
import { Alert, Pager, btnGhost, inputCls } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const ROLES = ['customer', 'inventory_manager', 'admin'];

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ users: [], total: 0, limit: 20 });
  const [historyUser, setHistoryUser] = useState(null);
  const [history, setHistory] = useState(null);
  const [historyError, setHistoryError] = useState('');
  const [historyVersion, refreshHistory] = useState(0);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const t = setTimeout(() => { setQ(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    const p = new URLSearchParams({ page, limit: 20 });
    if (q) p.set('search', q);
    if (role) p.set('role', role);
    api(`/users?${p}`).then(setData).catch((e) => setError(e.message));
  }, [q, role, page]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!historyUser) return;
    let current = true;
    setHistory(null); setHistoryError('');
    api(`/users/${historyUser.id}/history`)
      .then((entries) => { if (current) setHistory(entries); })
      .catch((err) => { if (current) setHistoryError(err.message); });
    return () => { current = false; };
  }, [historyUser, historyVersion]);

  const patch = async (u, body, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setError(''); setMsg('');
    try { await api(`/users/${u.id}`, { method: 'PATCH', body }); setMsg(`${u.name} updated`); load();
      if (historyUser?.id === u.id) refreshHistory((version) => version + 1); }
    catch (e) { setError(e.message); }
  };

  return (
    <div>
      <h1 className="mb-3 text-xl font-semibold">Users</h1>
      <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <input placeholder="Search name or email…" className={inputCls} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={inputCls} value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
        </select>
      </div>
      <Alert>{error}</Alert>
      <Alert type="ok">{msg}</Alert>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-slate-50 text-left text-slate-500">
            <th className="px-3 py-2">Name</th><th>Email</th><th>Role</th><th>Orders</th><th>Joined</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            {data.users.map((u) => {
              const isMe = u.id === me.id;
              return (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="px-3 py-2">{u.name}{isMe && <span className="ml-1 text-xs text-slate-400">(you)</span>}</td>
                  <td>{u.email}</td>
                  <td>
                    <select disabled={isMe} value={u.role} className="rounded border bg-white p-1"
                      onChange={(e) => patch(u, { role: e.target.value }, `Change ${u.name}'s role to ${e.target.value.replace('_', ' ')}?`)}>
                      {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                    </select>
                  </td>
                  <td>{u.orders_count}</td>
                  <td className="whitespace-nowrap">{dateTime(u.created_at)}</td>
                  <td>{u.is_active ? <span className="text-green-600">Active</span> : <span className="text-red-600">Deactivated</span>}</td>
                  <td className="space-x-2 whitespace-nowrap px-3 py-2 text-right">
                    <button className={btnGhost} onClick={() => setHistoryUser(u)}>History</button>
                    <button disabled={isMe} className={btnGhost}
                      onClick={() => patch(u, { is_active: !u.is_active }, u.is_active ? `Deactivate ${u.name}? They will be logged out immediately.` : null)}>
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {!data.users.length && <tr><td colSpan="7" className="p-4 text-center text-slate-500">No users found.</td></tr>}
          </tbody>
        </table>
      </div>
      {historyUser && (
        <section aria-label="Account change history" className="my-3 space-y-2 rounded-lg border bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Change history for {historyUser.name}</h2>
            <button className={btnGhost} onClick={() => setHistoryUser(null)}>Close history</button>
          </div>
          <Alert>{historyError}</Alert>
          {!history && !historyError && <p role="status">Loading history…</p>}
          {history?.length === 0 && <p className="text-sm text-slate-500">No recorded changes.</p>}
          {history?.map((entry) => (
            <div key={entry.id} className="rounded border p-2 text-sm">
              <p>{entry.actor_name || `Admin #${entry.actor_id}`} · {dateTime(entry.created_at)}</p>
              {entry.previous_role !== entry.new_role && <p>Role: {entry.previous_role} → {entry.new_role}</p>}
              {entry.previous_active !== entry.new_active && <p>Status: {entry.previous_active ? 'active' : 'inactive'} → {entry.new_active ? 'active' : 'inactive'}</p>}
            </div>
          ))}
        </section>
      )}
      <Pager page={page} total={data.total} limit={data.limit} onChange={setPage} />
    </div>
  );
}
