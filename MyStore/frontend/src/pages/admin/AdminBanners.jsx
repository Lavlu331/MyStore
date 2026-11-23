import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { Alert, btn, btnGhost, inputCls } from '../../components/ui.jsx';
import ImageUploader from '../../components/ImageUploader.jsx';

const EMPTY = { id: null, title: '', subtitle: '', image_url: '', link_url: '', sort_order: 0 };

export default function AdminBanners() {
  const [preview, setPreview] = useState('desktop');
  const [list, setList] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => { api('/banners/manage/all').then(setList).catch((e) => setError(e.message)); }, []);
  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setError(''); setMsg('');
    const body = { title: form.title, subtitle: form.subtitle, image_url: form.image_url, link_url: form.link_url, sort_order: Number(form.sort_order) || 0 };
    try {
      if (form.id) await api(`/banners/${form.id}`, { method: 'PUT', body });
      else await api('/banners', { method: 'POST', body });
      setMsg(form.id ? 'Banner updated' : 'Banner created');
      setForm(EMPTY); load();
    } catch (err) { setError(err.message); }
  };

  const toggle = async (b) => {
    setError('');
    try { await api(`/banners/${b.id}`, { method: 'PUT', body: { is_active: !b.is_active } }); load(); }
    catch (err) { setError(err.message); }
  };
  const remove = async (b) => {
    if (!window.confirm(`Delete the banner "${b.title}"?`)) return;
    try { await api(`/banners/${b.id}`, { method: 'DELETE' }); load(); } catch (err) { setError(err.message); }
  };

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Home page banners</h1>
      <p className="mb-3 text-sm text-slate-500">Banners rotate below the home page categories. Best image size: about 1200 × 400 pixels. Without an image, a colour banner with your title is shown.</p>
      <Alert>{error}</Alert>
      <Alert type="ok">{msg}</Alert>

      <form onSubmit={save} className="mb-5 grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2">
        <p className="font-medium sm:col-span-2">{form.id ? 'Edit banner' : 'New banner'}</p>
        <input required placeholder="Title" className={inputCls} value={form.title} onChange={set('title')} />
        <input placeholder="Subtitle (optional)" className={inputCls} value={form.subtitle || ''} onChange={set('subtitle')} />
        <input placeholder="Link, e.g. /shop?category=2 or https://…" className={inputCls} value={form.link_url || ''} onChange={set('link_url')} />
        <input type="number" placeholder="Order (smaller shows first)" className={inputCls} value={form.sort_order} onChange={set('sort_order')} />
        <input placeholder="Image address (or upload below)" className={`${inputCls} sm:col-span-2`} value={form.image_url || ''} onChange={set('image_url')} />
        <div className="sm:col-span-2"><ImageUploader onUploaded={(url) => setForm((f) => ({ ...f, image_url: url }))} /></div>
        <section className="space-y-2 sm:col-span-2" aria-label="Banner preview">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-auto font-medium">Banner preview</h2>
            {['desktop', 'mobile'].map((device) => <button key={device} type="button" aria-pressed={preview === device} className={preview === device ? btn : btnGhost} onClick={() => setPreview(device)}>{device === 'desktop' ? 'Desktop' : 'Mobile'}</button>)}
          </div>
          <div className={`mx-auto overflow-hidden rounded border ${preview === 'desktop' ? 'aspect-[3.1] w-full' : 'aspect-[2] w-full max-w-[23rem]'}`}>
            {form.image_url ? <img src={form.image_url} alt={form.title || 'Banner preview'} className="size-full object-cover" /> : (
              <div className="flex size-full flex-col justify-center bg-gradient-to-r from-orange-600 to-red-600 p-5 text-white">
                <p className="text-xl font-bold">{form.title || 'Banner title'}</p>
                {form.subtitle && <p className="mt-1 text-sm">{form.subtitle}</p>}
              </div>
            )}
          </div>
        </section>
        <div className="space-x-2 sm:col-span-2">
          <button className={btn}>{form.id ? 'Update banner' : 'Add banner'}</button>
          {form.id && <button type="button" onClick={() => setForm(EMPTY)} className={btnGhost}>Cancel edit</button>}
        </div>
      </form>

      <div className="space-y-3">
        {list.map((b) => (
          <div key={b.id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-white p-3">
            {b.image_url ? <img src={b.image_url} alt="" className="h-16 w-40 rounded object-cover" /> : <div className="flex h-16 w-40 items-center justify-center rounded bg-gradient-to-r from-orange-500 to-red-500 text-xs text-white">colour banner</div>}
            <div className="min-w-[10rem] flex-1">
              <p className="font-medium">{b.title}</p>
              <p className="text-xs text-slate-500">{b.link_url || 'no link'} · order {b.sort_order} · {b.is_active ? <span className="text-green-600">active</span> : <span className="text-slate-400">hidden</span>}</p>
            </div>
            <div className="space-x-2">
              <button onClick={() => setForm({ id: b.id, title: b.title, subtitle: b.subtitle || '', image_url: b.image_url || '', link_url: b.link_url || '', sort_order: b.sort_order })} className={btnGhost}>Edit</button>
              <button onClick={() => toggle(b)} className={btnGhost}>{b.is_active ? 'Hide' : 'Show'}</button>
              <button onClick={() => remove(b)} className={btnGhost}>Delete</button>
            </div>
          </div>
        ))}
        {!list.length && <p className="rounded-lg border bg-white p-4 text-center text-slate-500">No banners yet.</p>}
      </div>
    </div>
  );
}
