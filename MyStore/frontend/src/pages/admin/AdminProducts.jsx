import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { money } from '../../config';
import { Alert, Pager, btn, btnGhost, inputCls } from '../../components/ui.jsx';

export default function AdminProducts() {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({ category: '', no_photo: false, out_of_stock: false, inactive: false });
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ products: [], total: 0, limit: 20 });
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const t = setTimeout(() => { setQ(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    api('/categories/manage/all').then(setCategories).catch((e) => setError(e.message));
  }, []);

  const setFilter = (key, value) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setPage(1);
  };

  const load = useCallback(() => {
    const params = new URLSearchParams({ page, limit: 20 });
    if (q.trim()) params.set('search', q.trim());
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
    api(`/products/manage/all?${params}`).then(setData).catch((e) => setError(e.message));
  }, [q, page, filters]);
  useEffect(() => { load(); }, [load]);

  const toggle = async (p) => {
    setError(''); setMsg('');
    try {
      if (p.is_active) await api(`/products/${p.id}`, { method: 'DELETE' });
      else await api(`/products/${p.id}`, { method: 'PUT', body: { is_active: 1 } });
      setMsg(`"${p.name}" ${p.is_active ? 'deactivated' : 'activated'}`);
      load();
    } catch (e) { setError(e.message); }
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Products</h1>
        <Link to="/admin/products/new" className={btn}>+ New product</Link>
      </div>
      <input placeholder="Search products…" className={`${inputCls} mb-3 max-w-sm`} value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded border bg-white p-3 text-sm">
        <label className="flex items-center gap-2">Category
          <select className="rounded border bg-white p-2" value={filters.category} onChange={(e) => setFilter('category', e.target.value)}>
            <option value="">All categories</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        {[['no_photo', 'No photo'], ['out_of_stock', 'Out of stock'], ['inactive', 'Inactive']].map(([key, label]) => (
          <label key={key} className="flex items-center gap-1.5">
            <input type="checkbox" checked={filters[key]} onChange={(e) => setFilter(key, e.target.checked)} /> {label}
          </label>
        ))}
      </div>
      <Alert>{error}</Alert>
      <Alert type="ok">{msg}</Alert>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-slate-500">
              <th className="px-3 py-2">ID</th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {data.products.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="px-3 py-2">{p.id}</td>
                <td>{p.name}{!p.image && <p className="text-xs text-slate-500">No photo</p>}</td>
                <td>{p.category_name || '—'}</td>
                <td>{money(p.discount_price ?? p.price)}</td>
                <td className={p.total_stock <= 0 ? 'text-red-600' : ''}>{p.total_stock}</td>
                <td>{p.is_active ? <span className="text-green-600">Active</span> : <span className="text-slate-400">Inactive</span>}</td>
                <td className="space-x-2 whitespace-nowrap px-3 py-2 text-right">
                  <Link to={`/admin/products/${p.id}/edit`} className={btnGhost}>Edit</Link>
                  <button onClick={() => toggle(p)} className={btnGhost}>{p.is_active ? 'Deactivate' : 'Activate'}</button>
                </td>
              </tr>
            ))}
            {!data.products.length && <tr><td colSpan="7" className="p-4 text-center text-slate-500">No products found.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={data.total} limit={data.limit} onChange={setPage} />
    </div>
  );
}
