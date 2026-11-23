import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api';
import { Alert, btn, btnGhost, inputCls } from '../../components/ui.jsx';
import ImageUploader from '../../components/ImageUploader.jsx';

const EMPTY = { name: '', description: '', price: '', discount_price: '', category_id: '', is_active: true, images: '' };

export default function ProductForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/categories/manage/all').then(setCategories).catch((e) => setError(e.message));
    if (isEdit) {
      api(`/products/manage/${id}`).then((p) => setForm({
        name: p.name, description: p.description || '', price: p.price,
        discount_price: p.discount_price ?? '', category_id: p.category_id ?? '',
        is_active: Boolean(p.is_active), images: p.images.map((i) => i.image_url).join('\n'),
      })).catch((e) => setError(e.message));
    }
  }, [id, isEdit]);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const photos = form.images.split('\n').map((url) => url.trim()).filter(Boolean);
  const movePhoto = (from, to) => {
    const reordered = [...photos];
    reordered.splice(to, 0, ...reordered.splice(from, 1));
    setForm((previous) => ({ ...previous, images: reordered.join('\n') }));
  };
  const removePhoto = (index) => setForm((previous) => ({ ...previous, images: photos.filter((_, i) => i !== index).join('\n') }));

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    const body = {
      name: form.name.trim(),
      description: form.description,
      price: Number(form.price),
      discount_price: form.discount_price === '' ? null : Number(form.discount_price),
      category_id: form.category_id === '' ? null : Number(form.category_id),
      images: form.images.split('\n').map((l) => l.trim()).filter(Boolean),
    };
    try {
      if (isEdit) await api(`/products/${id}`, { method: 'PUT', body: { ...body, is_active: form.is_active ? 1 : 0 } });
      else await api('/products', { method: 'POST', body });
      navigate('/admin/products');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="max-w-xl">
      <Link to="/admin/products" className="text-sm text-orange-600 underline">← Products</Link>
      <h1 className="mb-3 mt-2 text-xl font-semibold">{isEdit ? 'Edit product' : 'New product'}</h1>
      <Alert>{error}</Alert>
      <form onSubmit={submit} className="space-y-3 rounded-lg border bg-white p-4">
        <input required placeholder="Name" className={inputCls} value={form.name} onChange={set('name')} />
        <textarea rows="4" placeholder="Description" className={inputCls} value={form.description} onChange={set('description')} />
        <div className="grid gap-3 sm:grid-cols-2">
          <input required type="number" min="0" step="0.01" placeholder="Price" className={inputCls} value={form.price} onChange={set('price')} />
          <input type="number" min="0" step="0.01" placeholder="Discount price (optional)" className={inputCls} value={form.discount_price} onChange={set('discount_price')} />
        </div>
        <select className={inputCls} value={form.category_id} onChange={set('category_id')}>
          <option value="">No category</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}{c.is_active ? '' : ' (inactive)'}</option>)}
        </select>
        <textarea rows="3" placeholder="Image URLs, one per line" className={inputCls} value={form.images} onChange={set('images')} />
        <ImageUploader onUploaded={(url) => setForm((f) => ({ ...f, images: f.images.trim() ? `${f.images.trim()}\n${url}` : url }))} />
        {photos.length > 0 && (
          <ol aria-label="Product photos" className="space-y-2">
            {photos.map((url, index) => (
              <li key={`${index}-${url}`} className="flex flex-wrap items-center gap-2 rounded border p-2">
                <img src={url} alt={`Product photo ${index + 1}`} className="size-16 rounded object-cover" />
                <span className="mr-auto text-sm font-medium">{index === 0 ? 'Cover' : `Photo ${index + 1}`}</span>
                <div className="flex flex-wrap gap-1">
                  {index > 0 && <button type="button" className={btnGhost} onClick={() => movePhoto(index, 0)}>Make cover</button>}
                  <button type="button" className={btnGhost} disabled={index === 0} onClick={() => movePhoto(index, index - 1)}>Move up</button>
                  <button type="button" className={btnGhost} disabled={index === photos.length - 1} onClick={() => movePhoto(index, index + 1)}>Move down</button>
                  <button type="button" className={btnGhost} onClick={() => removePhoto(index)}>Remove</button>
                </div>
              </li>
            ))}
          </ol>
        )}
        {isEdit && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active (visible in the shop)
          </label>
        )}
        {!isEdit && <p className="text-xs text-slate-500">Stock is added afterwards in Inventory → Add stock.</p>}
        <button disabled={busy} className={btn}>{busy ? 'Saving…' : 'Save product'}</button>
      </form>
    </div>
  );
}
