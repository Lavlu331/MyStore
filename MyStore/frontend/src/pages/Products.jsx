import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import ProductCard from '../components/ProductCard.jsx';
import { getCategories } from '../lib/categories.js';

const SORTS = [
  ['newest', 'Newest'],
  ['sold_desc', 'Best selling'],
  ['rating_desc', 'Top rated'],
  ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
  ['name_asc', 'Name A–Z'],
];
const RATINGS = [[4, '4 stars & up'], [3, '3 stars & up'], [2, '2 stars & up']];

const pageList = (page, total) => {
  const set = new Set([1, total, page - 2, page - 1, page, page + 1, page + 2].filter((p) => p >= 1 && p <= total));
  const sorted = [...set].sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => { if (i && p - sorted[i - 1] > 1) out.push('…'); out.push(p); });
  return out;
};

// All filters live in the address bar (?category=..&minPrice=..), so links and the back button just work
export default function Products() {
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [data, setData] = useState({ products: [], totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const filtersDialog = useRef(null);

  const search = params.get('search') || '';
  const category = params.get('category') || '';
  const sort = params.get('sort') || 'newest';
  const minRating = params.get('minRating') || '';
  const minPrice = params.get('minPrice') || '';
  const maxPrice = params.get('maxPrice') || '';
  const inStock = params.get('inStock') === 'true';
  const page = Number(params.get('page')) || 1;
  const [price, setPrice] = useState({ min: minPrice, max: maxPrice });

  useEffect(() => { getCategories().then(setCategories).catch(() => {}); }, []);
  useEffect(() => { setPrice({ min: minPrice, max: maxPrice }); }, [minPrice, maxPrice]);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => {
      if (v === '' || v === null || v === undefined || v === false) next.delete(k); else next.set(k, String(v));
    });
    if (!('page' in changes)) next.delete('page');
    setParams(next);
    window.scrollTo({ top: 0 });
  };
  const clearAll = () => { setParams({ ...(search && { search }), sort }); };

  useEffect(() => {
    const q = new URLSearchParams({ sort, page, limit: 12 });
    if (search) q.set('search', search);
    if (category) q.set('category', category);
    if (minPrice) q.set('minPrice', minPrice);
    if (maxPrice) q.set('maxPrice', maxPrice);
    if (minRating) q.set('minRating', minRating);
    if (inStock) q.set('inStock', 'true');
    setLoading(true); setError('');
    api(`/products?${q}`).then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [search, category, sort, minPrice, maxPrice, minRating, inStock, page]);

  const categoryName = categories.find((c) => String(c.id) === category)?.name;
  const chips = [
    categoryName && [`Category: ${categoryName}`, { category: '' }],
    search && [`“${search}”`, { search: '' }],
    (minPrice || maxPrice) && [`Price: ${minPrice || 0} – ${maxPrice || '∞'}`, { minPrice: '', maxPrice: '' }],
    minRating && [`${minRating}★ & up`, { minRating: '' }],
    inStock && ['In stock', { inStock: '' }],
  ].filter(Boolean);

  const box = 'rounded-xl border border-violet-100 bg-white p-4';
  const heading = 'mb-2 text-sm font-semibold text-slate-800';

  const renderFilters = (layout) => (
    <div className="space-y-3">
        <div className={box}>
          <p className={heading}>Categories</p>
          <ul className="space-y-0.5 text-sm">
            <li><button onClick={() => update({ category: '' })} className={`w-full rounded px-2 py-1 text-left hover:bg-orange-50 ${!category ? 'font-semibold text-orange-600' : 'text-slate-600'}`}>All products</button></li>
            {categories.map((c) => (
              <li key={c.id}>
                <button onClick={() => update({ category: c.id })}
                  className={`w-full rounded px-2 py-1 text-left hover:bg-orange-50 ${String(c.id) === category ? 'font-semibold text-orange-600' : 'text-slate-600'}`}>{c.name}</button>
              </li>
            ))}
          </ul>
        </div>

        <form className={box} onSubmit={(e) => { e.preventDefault(); update({ minPrice: price.min, maxPrice: price.max }); }}>
          <p className={heading}>Price</p>
          <div className="flex items-center gap-2">
            <input type="number" min="0" aria-label="Minimum price" placeholder="Min" value={price.min} onChange={(e) => setPrice({ ...price, min: e.target.value })} className="w-full rounded border p-1.5 text-sm" />
            <span className="text-slate-400">–</span>
            <input type="number" min="0" aria-label="Maximum price" placeholder="Max" value={price.max} onChange={(e) => setPrice({ ...price, max: e.target.value })} className="w-full rounded border p-1.5 text-sm" />
          </div>
          <button className="mt-2 w-full rounded bg-orange-600 py-1.5 text-sm font-medium text-white hover:bg-orange-700">Apply</button>
        </form>

        <div className={box}>
          <p className={heading}>Rating</p>
          <div className="space-y-1 text-sm">
            {RATINGS.map(([v, label]) => (
              <label key={v} className="flex cursor-pointer items-center gap-2">
                <input type="radio" name={`rating-${layout}`} checked={minRating === String(v)} onChange={() => update({ minRating: v })} />
                <span className="text-amber-500">{'★'.repeat(v)}</span><span className="text-slate-600">{label}</span>
              </label>
            ))}
            {minRating && <button onClick={() => update({ minRating: '' })} className="text-xs text-orange-600 hover:underline">Clear rating</button>}
          </div>
        </div>

        <div className={box}>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={inStock} onChange={(e) => update({ inStock: e.target.checked })} /> In stock only
          </label>
        </div>
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[230px_1fr]">
      <aside aria-label="Product filters" className="hidden lg:block">{renderFilters('desktop')}</aside>
      <dialog ref={filtersDialog} aria-labelledby="shop-filter-title" className="shop-filter-dialog">
        <div className="flex items-center justify-between gap-3 border-b border-violet-100 p-4">
          <h2 id="shop-filter-title" className="text-xl font-bold">Filters</h2>
          <button type="button" className="store-button store-button-outline" onClick={() => filtersDialog.current.close()}>Close</button>
        </div>
        <div className="min-h-0 overflow-y-auto p-4">{renderFilters('mobile')}</div>
        <div className="flex flex-wrap justify-between gap-2 border-t border-violet-100 p-4">
          <button type="button" onClick={clearAll} className="store-button store-button-outline">Clear all filters</button>
          <button type="button" onClick={() => filtersDialog.current.close()} className="store-button store-button-lime">Show results</button>
        </div>
      </dialog>

      {/* Results */}
      <section className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-100 bg-white px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{search ? `Results for “${search}”` : categoryName || 'All products'}</h1>
            <p className="text-xs text-slate-500">{data.total} item{data.total === 1 ? '' : 's'} found</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <button onClick={() => filtersDialog.current.showModal()} aria-haspopup="dialog" className="rounded border px-3 py-1.5 lg:hidden">Filters</button>
            <label className="flex items-center gap-2">
              <span className="hidden text-slate-500 sm:inline">Sort by</span>
              <select aria-label="Sort products" value={sort} onChange={(e) => update({ sort: e.target.value })} className="rounded border bg-white p-1.5">
                {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          </div>
        </div>

        {chips.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {chips.map(([label, change]) => (
              <button key={label} onClick={() => update(change)} className="flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-xs text-orange-800 hover:bg-orange-200">
                {label} <span aria-hidden="true">×</span>
              </button>
            ))}
            <button onClick={clearAll} className="text-xs text-slate-500 underline">Clear all</button>
          </div>
        )}

        {error && <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        {loading && <p className="py-10 text-center text-slate-500">Loading…</p>}
        {!loading && !error && data.products.length === 0 && (
          <div className="rounded-2xl border border-violet-100 bg-white py-16 text-center text-slate-500">
            <p className="text-lg">No products found</p>
            <p className="text-sm">Try fewer filters or a different search.</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {data.products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>

        {data.totalPages > 1 && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-1.5 text-sm">
            <button disabled={page <= 1} onClick={() => update({ page: page - 1 })} className="rounded border bg-white px-3 py-1.5 disabled:opacity-40">‹</button>
            {pageList(page, data.totalPages).map((p, i) => (p === '…'
              ? <span key={`d${i}`} className="px-1 text-slate-400">…</span>
              : <button key={p} onClick={() => update({ page: p })}
                  className={`min-w-[2.25rem] rounded border px-3 py-1.5 ${p === page ? 'border-orange-600 bg-orange-600 text-white' : 'bg-white hover:border-orange-500'}`}>{p}</button>))}
            <button disabled={page >= data.totalPages} onClick={() => update({ page: page + 1 })} className="rounded border bg-white px-3 py-1.5 disabled:opacity-40">›</button>
          </div>
        )}
      </section>
    </div>
  );
}
