import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const me = await login(form.email, form.password);
      const home = me.role === 'customer' ? '/' : '/admin';
      navigate(location.state?.from || home, { replace: true });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-sm rounded-lg border bg-white p-6">
      <h1 className="mb-4 text-xl font-semibold">Login</h1>
      {error && <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm font-medium"><span className="mb-1 block">Email</span><input type="email" required autoComplete="email" className="w-full rounded border p-2"
          value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label className="block text-sm font-medium"><span className="mb-1 block">Password</span><input type="password" required autoComplete="current-password" className="w-full rounded border p-2"
          value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        <button disabled={busy} className="w-full rounded bg-orange-600 p-2 text-white hover:bg-orange-700 disabled:opacity-50">
          {busy ? 'Logging in…' : 'Login'}
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-500">No account? <Link to="/register" className="text-orange-600 underline">Register</Link></p>
    </div>
  );
}
