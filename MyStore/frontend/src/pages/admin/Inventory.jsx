import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import { dateTime } from '../../config';
import { Alert, Pager, Tabs, btn, btnGhost, inputCls } from '../../components/ui.jsx';

export default function Inventory() {
  const [tab, setTab] = useState('stock');
  return (
    <div>
      <h1 className="mb-3 text-xl font-semibold">Inventory</h1>
      <Tabs tabs={[['stock', 'Stock'], ['history', 'History']]} value={tab} onChange={setTab} />
      {tab === 'stock' ? <Stock /> : <History />}
    </div>
  );
}

const ACTIONS = {
  restock: { title: 'Add stock', field: 'quantity', label: 'Quantity to add', min: 1 },
  adjust: { title: 'Adjust stock (set exact quantity)', field: 'new_quantity', label: 'New quantity', min: 0 },
  threshold: { title: 'Set low-stock threshold', field: 'low_stock_threshold', label: 'Threshold', min: 0 },
};

function Stock() {
  const stockForm = useRef(null);
  const [params] = useSearchParams();
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [productError, setProductError] = useState('');
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ search: '', warehouse_id: '', low: params.get('low') === 'true', page: 1 });
  const [data, setData] = useState({ items: [], total: 0, limit: 20 });
  const [panel, setPanel] = useState(null);   // { mode, product_id, warehouse_id }
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api('/inventory/warehouses').then(setWarehouses).catch(() => {});
  }, []);

  const panelOpen = Boolean(panel);
  useEffect(() => {
    if (!panelOpen) return;
    let current = true;
    const timer = setTimeout(() => {
      setProductError('');
      api(`/inventory/products?search=${encodeURIComponent(productSearch.trim())}`)
        .then((items) => { if (current) setProducts(items); })
        .catch((err) => { if (current) setProductError(err.message); });
    }, 200);
    return () => { current = false; clearTimeout(timer); };
  }, [panelOpen, productSearch]);

  const load = useCallback(() => {
    const p = new URLSearchParams({ page: f.page, limit: 20 });
    if (f.search) p.set('search', f.search);
    if (f.warehouse_id) p.set('warehouse_id', f.warehouse_id);
    if (f.low) p.set('low', 'true');
    api(`/inventory?${p}`).then(setData).catch((e) => setError(e.message));
  }, [f]);
  useEffect(() => { load(); }, [load]);

  const open = (mode, row) => {
    if (saving) return;
    setProductSearch(''); setProductError('');
    setPanel({ mode, product_name: row?.product_name, product_id: row?.product_id || '', warehouse_id: row?.warehouse_id || '' });
    setValue(mode === 'threshold' ? row?.low_stock_threshold ?? '' : mode === 'adjust' ? row?.quantity ?? '' : '');
    setNote(''); setError(''); setMsg('');
  };

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true); setError(''); setMsg('');
    const a = ACTIONS[panel.mode];
    const body = { product_id: Number(panel.product_id), warehouse_id: Number(panel.warehouse_id), [a.field]: Number(value) };
    if (panel.mode !== 'threshold') body.note = note;
    try {
      const path = { restock: ['POST', '/inventory/restock'], adjust: ['POST', '/inventory/adjust'], threshold: ['PATCH', '/inventory/threshold'] }[panel.mode];
      const r = await api(path[1], { method: path[0], body });
      setMsg(r.new_stock !== undefined ? `Done. Stock changed from ${r.previous_stock} to ${r.new_stock}.` : 'Threshold updated.');
      setPanel(null); load();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const a = panel && ACTIONS[panel.mode];
  const action = panel?.mode;
  useEffect(() => {
    if (action) {
      stockForm.current?.focus({ preventScroll: true });
      stockForm.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [action]);
  return (
    <div>
      <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input placeholder="Search product…" className={inputCls} value={f.search} onChange={(e) => setF({ ...f, search: e.target.value, page: 1 })} />
        <select className={inputCls} value={f.warehouse_id} onChange={(e) => setF({ ...f, warehouse_id: e.target.value, page: 1 })}>
          <option value="">All warehouses</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.low} onChange={(e) => setF({ ...f, low: e.target.checked, page: 1 })} /> Low stock only
        </label>
        <button onClick={() => open('restock')} className={btn}>+ Add stock</button>
      </div>

      <Alert>{error}</Alert>
      <Alert type="ok">{msg}</Alert>

      {panel && (
        <form ref={stockForm} tabIndex={-1} onSubmit={submit} className="mb-4 grid gap-3 rounded-lg border border-orange-200 bg-orange-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <p className="font-medium sm:col-span-2 lg:col-span-4">{a.title}</p>
          <label className="text-sm sm:col-span-2 lg:col-span-4">Find a product
            <input className={inputCls} disabled={saving} value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Product name or number" />
          </label>
          {productError && <p role="alert" className="text-sm text-red-600 sm:col-span-2 lg:col-span-4">{productError}</p>}
          <select disabled={saving} required aria-label="Product" className={inputCls} value={panel.product_id} onChange={(e) => setPanel({ ...panel, product_id: e.target.value, product_name: e.target.selectedOptions[0]?.text })}>
            <option value="">Select product</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            {/* keep the pre-selected product visible even if the list could not load */}
            {panel.product_id && !products.some((p) => String(p.id) === String(panel.product_id)) && <option value={panel.product_id}>{panel.product_name || `Product #${panel.product_id}`}</option>}
          </select>
          <select required aria-label="Warehouse" className={inputCls} value={panel.warehouse_id} onChange={(e) => setPanel({ ...panel, warehouse_id: e.target.value })}>
            <option value="">Select warehouse</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <input required type="number" min={a.min} placeholder={a.label} className={inputCls} value={value} onChange={(e) => setValue(e.target.value)} />
          {panel.mode !== 'threshold' && (
            <input required={panel.mode === 'adjust'} placeholder={panel.mode === 'adjust' ? 'Reason (required)' : 'Note (optional)'} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
          )}
          <div className="space-x-2 sm:col-span-2 lg:col-span-4">
            <button disabled={saving} className={btn}>{saving ? 'Saving…' : 'Save'}</button>
            <button type="button" disabled={saving} onClick={() => setPanel(null)} className={btnGhost}>Cancel</button>
          </div>
        </form>
      )}

      <div className="space-y-2 md:hidden">
        {data.items.map((row) => (
          <article key={`${row.product_id}-${row.warehouse_id}`} className="rounded-lg border bg-white p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="break-words font-semibold">{row.product_name}</h2>
                <p className="text-sm text-slate-600">{row.warehouse_name}</p>
              </div>
              <p className={`shrink-0 text-sm font-semibold ${row.is_low ? 'text-red-600' : ''}`}>{row.quantity} in stock{row.is_low && ' (low)'}</p>
            </div>
            <p className="mt-1 text-sm text-slate-600">Threshold: {row.low_stock_threshold ?? '—'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => open('restock', row)} className={btn}>Restock</button>
              <button onClick={() => open('adjust', row)} className={btnGhost}>Adjust</button>
              <button onClick={() => open('threshold', row)} className={btnGhost}>Threshold</button>
            </div>
          </article>
        ))}
        {!data.items.length && <p className="rounded-lg border bg-white p-4 text-center text-sm text-slate-500">No stock records.</p>}
      </div>
      <div className="hidden overflow-x-auto rounded-lg border bg-white md:block">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-slate-50 text-left text-slate-500">
            <th className="px-3 py-2">Product</th><th>Warehouse</th><th>Quantity</th><th>Threshold</th><th></th>
          </tr></thead>
          <tbody>
            {data.items.map((r) => (
              <tr key={`${r.product_id}-${r.warehouse_id}`} className="border-b last:border-0">
                <td className="px-3 py-2">{r.product_name}</td>
                <td>{r.warehouse_name}</td>
                <td className={r.is_low ? 'font-semibold text-red-600' : ''}>{r.quantity}{r.is_low && ' (low)'}</td>
                <td>{r.low_stock_threshold ?? '—'}</td>
                <td className="space-x-2 whitespace-nowrap px-3 py-2 text-right">
                  <button onClick={() => open('restock', r)} className={btnGhost}>Add</button>
                  <button onClick={() => open('adjust', r)} className={btnGhost}>Adjust</button>
                  <button onClick={() => open('threshold', r)} className={btnGhost}>Threshold</button>
                </td>
              </tr>
            ))}
            {!data.items.length && <tr><td colSpan="5" className="p-4 text-center text-slate-500">No stock records.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={f.page} total={data.total} limit={data.limit} onChange={(page) => setF({ ...f, page })} />
    </div>
  );
}

const TYPES = ['purchase', 'sale', 'restock', 'adjustment', 'return'];

function History() {
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ transactions: [], total: 0, limit: 20 });
  const [error, setError] = useState('');

  useEffect(() => {
    const p = new URLSearchParams({ page, limit: 20 });
    if (type) p.set('type', type);
    api(`/inventory/transactions?${p}`).then(setData).catch((e) => setError(e.message));
  }, [type, page]);

  return (
    <div>
      <select className={`${inputCls} mb-3 max-w-[200px]`} value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
        <option value="">All types</option>
        {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <Alert>{error}</Alert>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-slate-50 text-left text-slate-500">
            <th className="px-3 py-2">Date</th><th>Product</th><th>Warehouse</th><th>Type</th><th>Change</th><th>Before → After</th><th>Note</th><th>By</th>
          </tr></thead>
          <tbody>
            {data.transactions.map((t) => (
              <tr key={t.id} className="border-b last:border-0">
                <td className="whitespace-nowrap px-3 py-2">{dateTime(t.created_at)}</td>
                <td>{t.product_name}</td><td>{t.warehouse_name}</td><td>{t.transaction_type}</td>
                <td className={t.quantity < 0 ? 'text-red-600' : 'text-green-600'}>{t.quantity > 0 ? `+${t.quantity}` : t.quantity}</td>
                <td className="whitespace-nowrap">{t.previous_stock} → {t.new_stock}</td>
                <td>{t.note || '—'}</td><td>{t.performed_by_name || '—'}</td>
              </tr>
            ))}
            {!data.transactions.length && <tr><td colSpan="8" className="p-4 text-center text-slate-500">No transactions.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={data.total} limit={data.limit} onChange={setPage} />
    </div>
  );
}
