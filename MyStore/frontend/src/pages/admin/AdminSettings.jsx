import { useEffect, useState } from 'react';
import { api } from '../../api';
import { CURRENCY, money } from '../../config';
import { Alert, btn, inputCls } from '../../components/ui.jsx';

export default function AdminSettings() {
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sample, setSample] = useState(500);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const loadSettings = async () => {
    setLoading(true); setError('');
    try {
      const settings = await api('/settings');
      setForm({ delivery_charge: settings.delivery_charge, free_delivery_threshold: settings.free_delivery_threshold });
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };
  useEffect(() => { loadSettings(); }, []);

  const canSave = Boolean(form) && !loading && !saving && Object.values(form).every((value) =>
    String(value ?? '').trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0);

  const save = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true); setError(''); setMsg('');
    try {
      const s = await api('/settings', { method: 'PUT', body: form });
      setForm({ delivery_charge: s.delivery_charge, free_delivery_threshold: s.free_delivery_threshold });
      setMsg('Settings saved. New orders will use these values.');
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const subtotal = Number(sample);
  const threshold = Number(form?.free_delivery_threshold);
  const delivery = threshold > 0 && subtotal >= threshold ? 0 : Number(form?.delivery_charge);

  return (
    <div className="max-w-lg">
      <h1 className="mb-3 text-xl font-semibold">Store settings</h1>
      <Alert>{error}</Alert>
      <Alert type="ok">{msg}</Alert>
      {loading && <p role="status" className="py-4">Loading settings…</p>}
      {!loading && !form && <button type="button" className={btn} onClick={loadSettings}>Try again</button>}
      {form && <form onSubmit={save} className="space-y-4 rounded-lg border bg-white p-4">
        <label className="block text-sm">
          <span className="font-medium">Delivery charge ({CURRENCY})</span>
          <input required disabled={saving} type="number" min="0" step="0.01" className={`${inputCls} mt-1`} value={form.delivery_charge}
            onChange={(e) => setForm({ ...form, delivery_charge: e.target.value })} />
          <span className="text-xs text-slate-500">Added to every order. Use 0 for no delivery charge.</span>
        </label>
        <label className="block text-sm">
          <span className="font-medium">Free delivery above ({CURRENCY})</span>
          <input required disabled={saving} type="number" min="0" step="0.01" className={`${inputCls} mt-1`} value={form.free_delivery_threshold}
            onChange={(e) => setForm({ ...form, free_delivery_threshold: e.target.value })} />
          <span className="text-xs text-slate-500">Orders at or above this amount (after any coupon) get free delivery. Use 0 to switch this off.</span>
        </label>
        <div className="space-y-2 rounded bg-orange-50 p-3">
          <h2 className="font-semibold">Delivery preview</h2>
          <label className="block text-sm">Sample subtotal after coupon ({CURRENCY})
            <input type="number" min="0" step="0.01" className={inputCls} value={sample} onChange={(e) => setSample(e.target.value)} />
          </label>
          <p className="text-sm">Free delivery threshold: {threshold > 0 ? money(threshold) : 'Off'}</p>
          <p className="text-sm font-medium">{Object.values(form).every((value) => String(value ?? '').trim()) ? `Delivery: ${money(delivery)} · Order total: ${money(subtotal + delivery)}` : 'Enter both delivery settings to see a total.'}</p>
        </div>
        <button disabled={!canSave} className={btn}>{saving ? 'Saving…' : 'Save settings'}</button>
      </form>}
    </div>
  );
}
