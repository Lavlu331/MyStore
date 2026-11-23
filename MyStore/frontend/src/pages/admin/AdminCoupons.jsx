import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { money } from '../../config';
import { Alert, btn, btnGhost, inputCls } from '../../components/ui.jsx';

const EMPTY = {
  id: null, code: '', description: '', discount_type: 'percent', discount_value: '', max_discount: '',
  min_order_amount: '', usage_limit: '', per_user_limit: '1', starts_at: '', expires_at: '', is_public: false,
};

// Database date -> value for <input type="datetime-local">
const toInput = (v) => {
  if (!v) return '';
  const d = new Date(v);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const show = (v) => (v ? new Date(v).toLocaleString() : '—');

export default function AdminCoupons() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => { api('/coupons').then(setList).catch((e) => setError(e.message)); }, []);
  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const edit = (c) => {
    setForm({
      id: c.id, code: c.code, description: c.description || '', discount_type: c.discount_type,
      discount_value: c.discount_value, max_discount: c.max_discount ?? '', min_order_amount: c.min_order_amount,
      usage_limit: c.usage_limit ?? '', per_user_limit: c.per_user_limit,
      starts_at: toInput(c.starts_at), expires_at: toInput(c.expires_at), is_public: Boolean(c.is_public),
    });
    window.scrollTo(0, 0);
  };

  const save = async (e) => {
    e.preventDefault();
    setError(''); setMsg('');
    const body = {
      description: form.description, discount_type: form.discount_type, discount_value: form.discount_value,
      max_discount: form.discount_type === 'percent' ? form.max_discount : '',
      min_order_amount: form.min_order_amount, usage_limit: form.usage_limit, per_user_limit: form.per_user_limit,
      starts_at: form.starts_at, expires_at: form.expires_at, is_public: form.is_public,
    };
    try {
      if (form.id) await api(`/coupons/${form.id}`, { method: 'PUT', body });
      else await api('/coupons', { method: 'POST', body: { ...body, code: form.code } });
      setMsg(form.id ? 'Coupon updated' : 'Coupon created');
      setForm(EMPTY); load();
    } catch (err) { setError(err.message); }
  };

  const toggle = async (c) => {
    setError(''); setMsg('');
    try { await api(`/coupons/${c.id}`, { method: 'PUT', body: { is_active: !c.is_active } }); load(); }
    catch (err) { setError(err.message); }
  };

  const describe = (c) => (c.discount_type === 'percent'
    ? `${Number(c.discount_value)}% off${c.max_discount !== null ? ` (max ${money(c.max_discount)})` : ''}`
    : `${money(c.discount_value)} off`);

  return (
    <div>
      <h1 className="mb-3 text-xl font-semibold">Coupons</h1>
      <Alert>{error}</Alert>
      <Alert type="ok">{msg}</Alert>

      <form onSubmit={save} className="mb-5 grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <p className="font-medium sm:col-span-2 lg:col-span-4">{form.id ? `Edit coupon ${form.code}` : 'New coupon'}</p>
        <input required disabled={Boolean(form.id)} placeholder="Code (e.g. WELCOME10)" className={`${inputCls} uppercase disabled:bg-slate-100`} value={form.code} onChange={set('code')} />
        <select className={inputCls} value={form.discount_type} onChange={set('discount_type')}>
          <option value="percent">Percent (%)</option>
          <option value="fixed">Fixed amount</option>
        </select>
        <input required type="number" min="0.01" step="0.01" placeholder={form.discount_type === 'percent' ? 'Percent (1-100)' : 'Amount off'} className={inputCls} value={form.discount_value} onChange={set('discount_value')} />
        <input disabled={form.discount_type !== 'percent'} type="number" min="0" step="0.01" placeholder="Max discount (optional)" className={`${inputCls} disabled:bg-slate-100`} value={form.max_discount} onChange={set('max_discount')} />
        <input type="number" min="0" step="0.01" placeholder="Minimum order amount" className={inputCls} value={form.min_order_amount} onChange={set('min_order_amount')} />
        <input type="number" min="1" placeholder="Total uses (empty = unlimited)" className={inputCls} value={form.usage_limit} onChange={set('usage_limit')} />
        <input type="number" min="1" placeholder="Uses per customer" className={inputCls} value={form.per_user_limit} onChange={set('per_user_limit')} />
        <input placeholder="Description (optional)" className={inputCls} value={form.description} onChange={set('description')} />
        <label className="text-xs text-slate-500">Starts<input type="datetime-local" className={inputCls} value={form.starts_at} onChange={set('starts_at')} /></label>
        <label className="text-xs text-slate-500">Expires<input type="datetime-local" className={inputCls} value={form.expires_at} onChange={set('expires_at')} /></label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-4">
          <input type="checkbox" checked={form.is_public} onChange={(e) => setForm({ ...form, is_public: e.target.checked })} />
          Show this coupon to every customer on the My Vouchers page
        </label>
        <div className="space-x-2 sm:col-span-2 lg:col-span-4">
          <button className={btn}>{form.id ? 'Update coupon' : 'Create coupon'}</button>
          {form.id && <button type="button" onClick={() => setForm(EMPTY)} className={btnGhost}>Cancel edit</button>}
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-slate-50 text-left text-slate-500">
            <th className="px-3 py-2">Code</th><th>Discount</th><th>Min order</th><th>Uses</th><th>Validity</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="border-b last:border-0">
                <td className="px-3 py-2 font-mono font-medium">{c.code}{c.description && <p className="font-sans text-xs font-normal text-slate-500">{c.description}</p>}</td>
                <td>{describe(c)}</td>
                <td>{Number(c.min_order_amount) > 0 ? money(c.min_order_amount) : '—'}</td>
                <td className="whitespace-nowrap text-sm">
                  {c.used_count} used
                  <p className="text-xs text-slate-600">{c.usage_limit == null ? 'Unlimited' : `${Math.max(0, c.usage_limit - c.used_count)} remaining`}</p>
                </td>
                <td className="whitespace-nowrap text-xs">
                  <p>Starts: {c.starts_at ? show(c.starts_at) : 'Immediately'}</p>
                  <p className={c.expires_at && new Date(c.expires_at) <= new Date() ? 'font-semibold text-red-700' : ''}>
                    {c.expires_at && new Date(c.expires_at) <= new Date() ? 'Expired: ' : 'Expires: '}{c.expires_at ? show(c.expires_at) : 'Never'}
                  </p>
                </td>
                <td>{c.is_active ? <span className="text-green-600">Active</span> : <span className="text-slate-400">Inactive</span>}</td>
                <td className="space-x-2 whitespace-nowrap px-3 py-2 text-right">
                  <button onClick={() => edit(c)} className={btnGhost}>Edit</button>
                  <button onClick={() => toggle(c)} className={btnGhost}>{c.is_active ? 'Deactivate' : 'Activate'}</button>
                </td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan="7" className="p-4 text-center text-slate-500">No coupons yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
