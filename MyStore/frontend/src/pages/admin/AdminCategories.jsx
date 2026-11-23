import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { Alert, btn, btnGhost, inputCls } from '../../components/ui.jsx';
import ImageUploader from '../../components/ImageUploader.jsx';

const EMPTY = { id: null, name: '', description: '', image: '' };

export default function AdminCategories() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => { api('/categories/manage/all').then(setList).catch((e) => setError(e.message)); }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (e) => {
    e.preventDefault();
    setError(''); setMsg('');
    const body = { name: form.name.trim(), description: form.description || null, image: form.image || null };
    try {
      if (form.id) await api(`/categories/${form.id}`, { method: 'PUT', body });
      else await api('/categories', { method: 'POST', body });
      setMsg(form.id ? 'Category updated' : 'Category created');
      setForm(EMPTY); load();
    } catch (err) { setError(err.message); }
  };

  const toggle = async (c) => {
    setError(''); setMsg('');
    try {
      if (c.is_active) await api(`/categories/${c.id}`, { method: 'DELETE' });
      else await api(`/categories/${c.id}`, { method: 'PUT', body: { is_active: 1 } });
      load();
    } catch (err) { setError(err.message); }
  };

  return (
    <div>
      <h1 className="mb-3 text-xl font-semibold">Categories</h1>
      <Alert>{error}</Alert>
      <Alert type="ok">{msg}</Alert>
      <form onSubmit={save} className="mb-5 grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-3">
        <input required placeholder="Name" className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Description" className={inputCls} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <input placeholder="Image URL" className={inputCls} value={form.image || ''} onChange={(e) => setForm({ ...form, image: e.target.value })} />
        <div className="sm:col-span-3"><ImageUploader onUploaded={(url) => setForm((f) => ({ ...f, image: url }))} /></div>
        <div className="space-x-2 sm:col-span-3">
          <button className={btn}>{form.id ? 'Update category' : 'Add category'}</button>
          {form.id && <button type="button" onClick={() => setForm(EMPTY)} className={btnGhost}>Cancel edit</button>}
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-slate-50 text-left text-slate-500"><th className="px-3 py-2">Name</th><th>Description</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="border-b last:border-0">
                <td className="px-3 py-2">{c.name}</td>
                <td>{c.description || '—'}</td>
                <td>{c.is_active ? <span className="text-green-600">Active</span> : <span className="text-slate-400">Inactive</span>}</td>
                <td className="space-x-2 whitespace-nowrap px-3 py-2 text-right">
                  <button onClick={() => setForm({ id: c.id, name: c.name, description: c.description || '', image: c.image || '' })} className={btnGhost}>Edit</button>
                  <button onClick={() => toggle(c)} className={btnGhost}>{c.is_active ? 'Deactivate' : 'Activate'}</button>
                </td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan="4" className="p-4 text-center text-slate-500">No categories yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
