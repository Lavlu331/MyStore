import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, uploadFile } from '../api';
import AccountLayout from '../components/AccountLayout.jsx';
import Avatar from '../components/Avatar.jsx';
import { Alert, btn, btnGhost, inputCls } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const Row = ({ label, children }) => (
  <div className="grid gap-1 border-b py-3 last:border-0 sm:grid-cols-[160px_1fr]">
    <dt className="text-sm text-slate-500">{label}</dt>
    <dd className="text-sm font-medium">{children || <span className="font-normal text-slate-400">Not added</span>}</dd>
  </div>
);
const GENDERS = { male: 'Male', female: 'Female', other: 'Other' };

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const fileRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: user.name || '', phone: user.phone || '', birthday: user.birthday || '', gender: user.gender || '' });
  const [msg, setMsg] = useState({ type: 'ok', text: '' });
  const [photoBusy, setPhotoBusy] = useState(false);
  const [defaultAddress, setDefaultAddress] = useState(undefined);

  useEffect(() => {
    api('/addresses').then((l) => setDefaultAddress(l.find((a) => a.is_default) || null)).catch(() => setDefaultAddress(null));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      await api('/auth/me', { method: 'PUT', body: form });
      await refreshUser();
      setMsg({ type: 'ok', text: 'Profile saved' });
      setEditing(false);
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  };

  const pickPhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoBusy(true); setMsg({ type: 'ok', text: '' });
    try {
      await uploadFile('/account/avatar', file);
      await refreshUser();
      setMsg({ type: 'ok', text: 'Profile photo updated' });
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
    finally { setPhotoBusy(false); e.target.value = ''; }
  };

  const removePhoto = async () => {
    setPhotoBusy(true);
    try { await api('/account/avatar', { method: 'DELETE' }); await refreshUser(); setMsg({ type: 'ok', text: 'Profile photo removed' }); }
    catch (err) { setMsg({ type: 'error', text: err.message }); } finally { setPhotoBusy(false); }
  };

  const since = user.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : null;
  const birthday = user.birthday ? new Date(`${user.birthday}T00:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : null;

  return (
    <AccountLayout title="My Profile">
      <Alert type={msg.type}>{msg.text}</Alert>

      <section className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="h-20 bg-gradient-to-r from-orange-500 to-red-500" />
        <div className="px-5 pb-5">
          <div className="-mt-10 flex flex-wrap items-end gap-4">
            <Avatar user={user} size="h-24 w-24" text="text-4xl" ring="ring-4 ring-white" />
            <div className="min-w-0 flex-1 pb-1"><p className="truncate text-xl font-bold">{user.name}</p><p className="truncate text-sm text-slate-500">{user.email}</p></div>
            <div className="flex gap-2 pb-1">
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={pickPhoto} className="hidden" />
              <button onClick={() => fileRef.current.click()} disabled={photoBusy} className={btn}>{photoBusy ? 'Please wait…' : user.avatar_url ? 'Change photo' : 'Upload photo'}</button>
              {user.avatar_url && <button onClick={removePhoto} disabled={photoBusy} className={btnGhost}>Remove</button>}
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-400">JPG, PNG, WEBP or GIF, up to 2 MB.</p>
        </div>
      </section>

      <section className="mt-3 rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-semibold">Personal information</h2>
          {!editing && <button onClick={() => { setMsg({ type: 'ok', text: '' }); setForm({ name: user.name || '', phone: user.phone || '', birthday: user.birthday || '', gender: user.gender || '' }); setEditing(true); }} className="text-sm font-semibold text-orange-600 hover:underline">EDIT</button>}
        </div>
        {!editing ? (
          <dl>
            <Row label="Full name">{user.name}</Row>
            <Row label="Email address">{user.email}</Row>
            <Row label="Mobile">{user.phone}</Row>
            <Row label="Birthday">{birthday}</Row>
            <Row label="Gender">{GENDERS[user.gender]}</Row>
            <Row label="Member since">{since}</Row>
          </dl>
        ) : (
          <form onSubmit={save} className="space-y-3 pt-2">
            <label className="block text-xs text-slate-500">Email address (cannot be changed)<input disabled className={`${inputCls} mt-1 bg-slate-100`} value={user.email} /></label>
            <label className="block text-xs text-slate-500">Full name<input required className={`${inputCls} mt-1`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="block text-xs text-slate-500">Mobile<input className={`${inputCls} mt-1`} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs text-slate-500">Birthday<input type="date" max={new Date().toISOString().slice(0, 10)} className={`${inputCls} mt-1`} value={form.birthday} onChange={(e) => setForm({ ...form, birthday: e.target.value })} /></label>
              <label className="block text-xs text-slate-500">Gender
                <select className={`${inputCls} mt-1`} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                  <option value="">Prefer not to say</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
                </select>
              </label>
            </div>
            <div className="space-x-2"><button className={btn}>Save changes</button><button type="button" onClick={() => setEditing(false)} className={btnGhost}>Cancel</button></div>
          </form>
        )}
      </section>

      <section className="mt-3 rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-semibold">Default delivery address</h2>
          <Link to="/account/addresses" className="text-sm font-semibold text-orange-600 hover:underline">MANAGE</Link>
        </div>
        {defaultAddress === undefined && <p className="text-sm text-slate-400">Loading…</p>}
        {defaultAddress === null && <p className="text-sm text-slate-500">You have not saved an address yet. <Link to="/account/addresses" className="text-orange-600 underline">Add one</Link> to check out faster.</p>}
        {defaultAddress && (
          <p className="text-sm text-slate-700"><span className="mr-2 rounded bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">{defaultAddress.label}</span>
            {defaultAddress.street}, {defaultAddress.city} {defaultAddress.postal_code} {defaultAddress.country}<br /><span className="text-slate-500">Phone: {defaultAddress.phone}</span></p>
        )}
      </section>

      <p className="mt-3 rounded-xl bg-white p-4 text-sm text-slate-600 shadow-sm">🔒 Password, devices and your data are in <Link to="/account/security" className="font-semibold text-orange-600 hover:underline">Login &amp; Security</Link>.</p>
    </AccountLayout>
  );
}
