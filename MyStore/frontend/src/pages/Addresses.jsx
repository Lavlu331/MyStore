import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import AccountLayout from '../components/AccountLayout.jsx';
import { Alert, btn, btnGhost, inputCls } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const EMPTY = { id: null, label: 'Home', phone: '', street: '', city: '', postal_code: '', country: '', is_default: false };
const LABELS = ['Home', 'Office', 'Other'];

export default function Addresses() {
  const { user, refreshUser } = useAuth();
  const [list, setList] = useState(null);
  const [form, setForm] = useState(null);       // null = form closed
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => { api('/addresses').then(setList).catch((e) => setError(e.message)); }, []);
  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const openNew = () => { setError(''); setMsg(''); setForm({ ...EMPTY, phone: user.phone || '', is_default: !list?.length }); };

  const save = async (e) => {
    e.preventDefault();
    setError(''); setMsg('');
    const { id, ...body } = form;
    try {
      if (id) await api(`/addresses/${id}`, { method: 'PUT', body });
      else await api('/addresses', { method: 'POST', body });
      setMsg(id ? 'Address updated' : 'Address saved');
      setForm(null); load(); refreshUser();
    } catch (err) { setError(err.message); }
  };

  const makeDefault = async (a) => { try { await api(`/addresses/${a.id}/default`, { method: 'PUT' }); load(); refreshUser(); } catch (err) { setError(err.message); } };
  const remove = async (a) => {
    if (!window.confirm('Delete this address?')) return;
    try { await api(`/addresses/${a.id}`, { method: 'DELETE' }); setMsg('Address deleted'); load(); refreshUser(); } catch (err) { setError(err.message); }
  };

  return (
    <AccountLayout title="Address Book">
      <Alert>{error}</Alert>
      <Alert type="ok">{msg}</Alert>

      {form && (
        <form onSubmit={save} className="mb-4 space-y-3 rounded bg-white p-4">
          <h2 className="font-semibold">{form.id ? 'Edit address' : 'Add a new address'}</h2>
          <div className="flex flex-wrap gap-2">
            {LABELS.map((l) => (
              <button type="button" key={l} onClick={() => setForm({ ...form, label: l })}
                className={`rounded-full border px-4 py-1 text-sm ${form.label === l ? 'border-orange-600 bg-orange-50 font-medium text-orange-700' : 'hover:border-slate-400'}`}>{l}</button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium"><span className="mb-1 block">Phone number</span><input required autoComplete="tel" type="tel" className={inputCls} value={form.phone} onChange={set('phone')} /></label>
            <label className="block text-sm font-medium"><span className="mb-1 block">City</span><input required autoComplete="address-level2" type="text" className={inputCls} value={form.city} onChange={set('city')} /></label>
          </div>
          <label className="block text-sm font-medium"><span className="mb-1 block">Street address</span><input required autoComplete="street-address" type="text" className={inputCls} value={form.street} onChange={set('street')} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium"><span className="mb-1 block">Postal code</span><input autoComplete="postal-code" type="text" className={inputCls} value={form.postal_code || ''} onChange={set('postal_code')} /></label>
            <label className="block text-sm font-medium"><span className="mb-1 block">Country</span><input autoComplete="country-name" type="text" className={inputCls} value={form.country || ''} onChange={set('country')} /></label>
          </div>
          {!form.is_default || !form.id ? (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} /> Set as my default delivery address
            </label>
          ) : null}
          <div className="space-x-2"><button className={btn}>Save address</button><button type="button" onClick={() => setForm(null)} className={btnGhost}>Cancel</button></div>
        </form>
      )}

      {!list && !error && <p className="py-10 text-center text-slate-500">Loading…</p>}
      {list && (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((a) => (
            <div key={a.id} className={`flex flex-col rounded bg-white p-4 ${a.is_default ? 'ring-2 ring-orange-400' : ''}`}>
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">{a.label}</span>
                {a.is_default && <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">DEFAULT</span>}
              </div>
              <p className="flex-1 text-sm text-slate-700">{a.street}<br />{a.city} {a.postal_code}<br />{a.country}<br /><span className="text-slate-500">Phone: {a.phone || '—'}</span></p>
              <div className="mt-3 flex flex-wrap gap-3 border-t pt-2 text-sm">
                <button onClick={() => { setError(''); setMsg(''); setForm({ ...a }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="font-medium text-orange-600 hover:underline">Edit</button>
                {!a.is_default && <button onClick={() => makeDefault(a)} className="text-slate-600 hover:text-orange-600">Set as default</button>}
                <button onClick={() => remove(a)} className="ml-auto text-red-600 hover:underline">Delete</button>
              </div>
            </div>
          ))}
          {!form && list.length < 10 && (
            <button onClick={openNew} className="flex min-h-[9rem] flex-col items-center justify-center rounded border-2 border-dashed border-slate-300 bg-white text-slate-500 hover:border-orange-400 hover:text-orange-600">
              <span className="text-3xl">＋</span><span className="font-medium">Add a new address</span>
            </button>
          )}
        </div>
      )}
      {list && !list.length && !form && <p className="mt-3 text-sm text-slate-500">You have no saved addresses yet. Save one now and it will be ready at checkout.</p>}
    </AccountLayout>
  );
}
