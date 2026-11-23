import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { money } from '../../config';
import { Alert, btn, btnGhost, inputCls } from '../../components/ui.jsx';

const STATE_STYLE = {
  live: 'bg-green-100 text-green-800', upcoming: 'bg-blue-100 text-blue-800',
  ended: 'bg-slate-200 text-slate-600', disabled: 'bg-red-100 text-red-700',
};
const EMPTY = { title: '', starts_at: '', ends_at: '' };
const show = (v) => (v ? v.replace('T', ' ') : '—');

export default function AdminFlashSales() {
  const [timeZone, setTimeZone] = useState('store time');
  const [list, setList] = useState([]);
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [productsLoading, setProductsLoading] = useState(false);
  const [productError, setProductError] = useState('');
  const [chosen, setChosen] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [add, setAdd] = useState({ product_id: '', sale_price: '' });
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const loadList = useCallback(() => { api('/flash-sales').then(setList).catch((e) => setError(e.message)); }, []);
  const loadDetail = useCallback((id) => {
    if (!id) { setDetail(null); return; }
    api(`/flash-sales/${id}`).then(setDetail).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    loadList();
    api('/flash-sales/clock').then((clock) => setTimeZone(clock.time_zone)).catch((err) => setError(err.message));
  }, [loadList]);
  useEffect(() => { loadDetail(selectedId); }, [selectedId, loadDetail]);

  useEffect(() => {
    if (!selectedId) return;
    let current = true;
    setProductsLoading(true);
    setProductError('');
    setProducts([]);
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ active: 'true', limit: 20, search: productSearch.trim() });
      api(`/products/manage/all?${params}`)
        .then((result) => { if (current) setProducts(result.products); })
        .catch((err) => { if (current) setProductError(err.message); })
        .finally(() => { if (current) setProductsLoading(false); });
    }, 200);
    return () => { current = false; clearTimeout(timer); };
  }, [selectedId, productSearch]);

  const note = (text) => { setMsg(text); setError(''); };
  const fail = (e) => { setError(e.message); setMsg(''); };

  const create = async (e) => {
    e.preventDefault();
    try {
      const r = await api('/flash-sales', { method: 'POST', body: form });
      note('Flash sale created. Now add products to it.');
      setForm(EMPTY); loadList(); setSelectedId(r.id);
    } catch (err) { fail(err); }
  };

  const saveWindow = async (e) => {
    e.preventDefault();
    try {
      await api(`/flash-sales/${detail.id}`, { method: 'PUT', body: { title: detail.title, starts_at: detail.starts_at, ends_at: detail.ends_at } });
      note('Saved'); loadList(); loadDetail(detail.id);
    } catch (err) { fail(err); }
  };

  const toggle = async () => {
    try { await api(`/flash-sales/${detail.id}`, { method: 'PUT', body: { is_active: !detail.is_active } }); loadList(); loadDetail(detail.id); }
    catch (err) { fail(err); }
  };

  const removeSale = async () => {
    if (!window.confirm(`Delete the flash sale "${detail.title}"? Prices return to normal immediately.`)) return;
    try { await api(`/flash-sales/${detail.id}`, { method: 'DELETE' }); setSelectedId(null); note('Flash sale deleted'); loadList(); }
    catch (err) { fail(err); }
  };

  const addItem = async (e) => {
    e.preventDefault();
    try {
      await api(`/flash-sales/${detail.id}/items`, { method: 'POST', body: add });
      setChosen(null); setAdd({ product_id: '', sale_price: '' }); note('Product added'); loadDetail(detail.id); loadList();
    } catch (err) { fail(err); }
  };

  const removeItem = async (productId) => {
    try { await api(`/flash-sales/${detail.id}/items/${productId}`, { method: 'DELETE' }); loadDetail(detail.id); loadList(); }
    catch (err) { fail(err); }
  };

  const choices = chosen && !products.some((product) => product.id === chosen.id) ? [chosen, ...products] : products;
  const chosenPrice = chosen ? Number(chosen.discount_price ?? chosen.price) : null;
  const preview = chosen && Number(add.sale_price) > 0 && Number(add.sale_price) < chosenPrice
    ? Math.round((1 - Number(add.sale_price) / chosenPrice) * 100) : null;

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Flash sales</h1>
      <p className="mb-3 text-sm text-slate-500">While a sale is live, its products sell at the sale price everywhere (shop, cart and checkout) and the home page shows a countdown. When the sale ends, prices return to normal by themselves.</p>
      <Alert>{error}</Alert>
      <Alert type="ok">{msg}</Alert>

      <form onSubmit={create} className="mb-5 grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-3">
        <p className="font-medium sm:col-span-3">New flash sale</p>
        <input required maxLength={100} placeholder="Title, e.g. Weekend Flash Sale" className={`${inputCls} sm:col-span-3`} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <label className="text-xs text-slate-500">Starts ({timeZone})<input required type="datetime-local" className={inputCls} value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></label>
        <label className="text-xs text-slate-500">Ends ({timeZone})<input required type="datetime-local" className={inputCls} value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></label>
        <div className="self-end"><button className={btn}>Create sale</button></div>
      </form>

      <div className="space-y-2">
        {list.map((s) => (
          <button key={s.id} onClick={() => setSelectedId(selectedId === s.id ? null : s.id)}
            className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border bg-white p-3 text-left hover:border-orange-400 ${selectedId === s.id ? 'border-orange-500 ring-1 ring-orange-300' : ''}`}>
            <div>
              <p className="font-medium">⚡ {s.title}</p>
              <p className="text-xs text-slate-500">{show(s.starts_at)} → {show(s.ends_at)} ({timeZone}) · {s.item_count} product{s.item_count === 1 ? '' : 's'}</p>
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATE_STYLE[s.state]}`}>{s.state}</span>
          </button>
        ))}
        {!list.length && <p className="rounded-lg border bg-white p-4 text-center text-slate-500">No flash sales yet.</p>}
      </div>

      {detail && (
        <div className="mt-5 space-y-4 rounded-lg border border-orange-200 bg-white p-4">
          <form onSubmit={saveWindow} className="grid gap-3 sm:grid-cols-3">
            <p className="font-medium sm:col-span-3">Sale details <span className={`ml-2 rounded-full px-2.5 py-0.5 text-xs capitalize ${STATE_STYLE[detail.state]}`}>{detail.state}</span></p>
            <input required maxLength={100} className={`${inputCls} sm:col-span-3`} value={detail.title} onChange={(e) => setDetail({ ...detail, title: e.target.value })} />
            <label className="text-xs text-slate-500">Starts ({timeZone})<input required type="datetime-local" className={inputCls} value={detail.starts_at} onChange={(e) => setDetail({ ...detail, starts_at: e.target.value })} /></label>
            <label className="text-xs text-slate-500">Ends ({timeZone})<input required type="datetime-local" className={inputCls} value={detail.ends_at} onChange={(e) => setDetail({ ...detail, ends_at: e.target.value })} /></label>
            <div className="flex flex-wrap items-end gap-2">
              <button className={btn}>Save</button>
              <button type="button" onClick={toggle} className={btnGhost}>{detail.is_active ? 'Disable' : 'Enable'}</button>
              <button type="button" onClick={removeSale} className={btnGhost}>Delete</button>
            </div>
          </form>

          <div>
            <p className="mb-2 font-medium">Products in this sale</p>
            <div className="divide-y rounded border">
              {detail.items.map((i) => {
                const normal = Number(i.discount_price ?? i.price);
                return (
                  <div key={i.product_id} className="flex flex-wrap items-center gap-3 p-2 text-sm">
                    {i.image ? <img src={i.image} alt="" className="h-10 w-10 rounded object-cover" /> : <span className="h-10 w-10 rounded bg-slate-100" />}
                    <span className="min-w-[8rem] flex-1">{i.name}</span>
                    <span className="text-slate-400 line-through">{money(normal)}</span>
                    <span className="font-semibold text-orange-600">{money(i.sale_price)}</span>
                    <span className="rounded bg-orange-100 px-2 text-xs text-orange-700">-{Math.round((1 - Number(i.sale_price) / normal) * 100)}%</span>
                    <button onClick={() => removeItem(i.product_id)} className="text-red-600 hover:underline">Remove</button>
                  </div>
                );
              })}
              {!detail.items.length && <p className="p-3 text-center text-sm text-slate-500">No products yet.</p>}
            </div>
          </div>

          <form onSubmit={addItem} className="grid gap-3 rounded bg-gray-50 p-3 sm:grid-cols-[minmax(0,1fr)_160px_auto]">
            <label className="text-sm sm:col-span-3">Search active products
              <input className={inputCls} placeholder="Product name or #item number" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
            </label>
            {productError && <p role="alert" className="text-sm text-red-700 sm:col-span-3">{productError}</p>}
            {!productError && (productsLoading || !products.length) && (
              <p role="status" className="text-sm text-slate-600 sm:col-span-3">{productsLoading ? 'Searching products…' : 'No active products match.'}</p>
            )}
            <select required aria-label="Choose a product" className={inputCls} value={add.product_id} onChange={(e) => {
              const id = e.target.value;
              setChosen(choices.find((product) => String(product.id) === id) || null);
              setAdd({ ...add, product_id: id });
            }}>
              <option value="">Choose a product…</option>
              {choices.map((product) => <option key={product.id} value={product.id}>{product.name} · #{product.id} ({money(product.discount_price ?? product.price)})</option>)}
            </select>
            <input required type="number" min="0.01" step="0.01" placeholder="Sale price" className={inputCls} value={add.sale_price} onChange={(e) => setAdd({ ...add, sale_price: e.target.value })} />
            <button className={btn}>Add product</button>
            <p className="text-xs text-slate-500 sm:col-span-3">
              {chosen ? `Current price ${money(chosenPrice)}. ` : ''}The sale price must be lower than the current price.{preview ? ` This is ${preview}% off.` : ''}
            </p>
          </form>
        </div>
      )}
    </div>
  );
}
