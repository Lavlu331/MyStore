import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import AccountLayout from '../components/AccountLayout.jsx';
import { Alert, btn, btnGhost, inputCls } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const Card = ({ title, text, children, tone = '' }) => (
  <section className={`mb-3 rounded-xl bg-white p-4 shadow-sm ${tone}`}>
    <h2 className="font-semibold">{title}</h2>
    {text && <p className="mb-3 mt-0.5 text-sm text-slate-500">{text}</p>}
    {children}
  </section>
);

export default function Security() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pw, setPw] = useState({ current_password: '', new_password: '' });
  const [pwMsg, setPwMsg] = useState({ type: 'ok', text: '' });
  const [devMsg, setDevMsg] = useState({ type: 'ok', text: '' });
  const [dataMsg, setDataMsg] = useState({ type: 'ok', text: '' });
  const [close, setClose] = useState({ password: '', sure: false });
  const [closeMsg, setCloseMsg] = useState({ type: 'error', text: '' });
  const [busy, setBusy] = useState('');

  // The server answers with a fresh token for THIS device while ending the other sessions
  const keepSession = (token) => { if (token) localStorage.setItem('token', token); };

  const changePassword = async (e) => {
    e.preventDefault();
    setBusy('pw');
    try {
      const r = await api('/auth/password', { method: 'PUT', body: pw });
      keepSession(r.token);
      setPw({ current_password: '', new_password: '' });
      setPwMsg({ type: 'ok', text: r.message });
    } catch (err) { setPwMsg({ type: 'error', text: err.message }); } finally { setBusy(''); }
  };

  const signOutOthers = async () => {
    if (!window.confirm('Sign out of every other device? This device stays signed in.')) return;
    setBusy('dev');
    try {
      const r = await api('/account/revoke-sessions', { method: 'POST' });
      keepSession(r.token);
      setDevMsg({ type: 'ok', text: r.message });
    } catch (err) { setDevMsg({ type: 'error', text: err.message }); } finally { setBusy(''); }
  };

  const download = async () => {
    setBusy('data'); setDataMsg({ type: 'ok', text: '' });
    try {
      const res = await fetch('/api/account/export', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      if (!res.ok) throw new Error('Could not prepare your data');
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url; a.download = 'my-data.json'; a.click();
      URL.revokeObjectURL(url);
      setDataMsg({ type: 'ok', text: 'Your data was downloaded.' });
    } catch (err) { setDataMsg({ type: 'error', text: err.message }); } finally { setBusy(''); }
  };

  const deactivate = async (e) => {
    e.preventDefault();
    setBusy('close');
    try {
      await api('/account/deactivate', { method: 'POST', body: { password: close.password } });
      logout(); navigate('/');
    } catch (err) { setCloseMsg({ type: 'error', text: err.message }); setBusy(''); }
  };

  return (
    <AccountLayout title="Login & Security">
      <Card title="Change password" text="After a change, every other device is signed out.">
        <Alert type={pwMsg.type}>{pwMsg.text}</Alert>
        <form onSubmit={changePassword} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <input required type="password" placeholder="Current password" className={inputCls} value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} />
            <input required type="password" minLength={8} placeholder="New password (min 8 characters)" className={inputCls} value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} />
          </div>
          <button disabled={busy === 'pw'} className={btn}>Change password</button>
        </form>
      </Card>

      <Card title="Your devices" text="Signed in on a shared or lost device? End every other session. You will stay signed in here.">
        <Alert type={devMsg.type}>{devMsg.text}</Alert>
        <button onClick={signOutOthers} disabled={busy === 'dev'} className={btnGhost}>Sign out of all other devices</button>
      </Card>

      <div id="data" />
      <Card title="Your data" text="Download a copy of what we store about you: profile, addresses, orders, reviews and wishlist, as a JSON file. Your password is never included.">
        <Alert type={dataMsg.type}>{dataMsg.text}</Alert>
        <button onClick={download} disabled={busy === 'data'} className={btnGhost}>{busy === 'data' ? 'Preparing…' : '⬇ Download my data'}</button>
      </Card>

      {user.role === 'customer' && (
        <Card title="Close my account" tone="border border-red-200"
          text="This deactivates your account and signs you out everywhere. You cannot close it while an order is still on its way. Your order history is kept for our records.">
          <Alert type={closeMsg.type}>{closeMsg.text}</Alert>
          <form onSubmit={deactivate} className="space-y-3">
            <input required type="password" placeholder="Enter your password to confirm" className={inputCls} value={close.password} onChange={(e) => setClose({ ...close, password: e.target.value })} />
            <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={close.sure} onChange={(e) => setClose({ ...close, sure: e.target.checked })} /> I understand that I will be signed out and cannot log in again.</label>
            <button disabled={!close.sure || busy === 'close'} className="rounded bg-red-600 px-4 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-40">Close my account</button>
          </form>
        </Card>
      )}
    </AccountLayout>
  );
}
