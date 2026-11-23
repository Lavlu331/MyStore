import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const FIELDS = [
  ['name', 'Full name', 'text', true],
  ['email', 'Email', 'email', true],
  ['password', 'Password (min 8 characters)', 'password', true],
  ['phone', 'Phone', 'tel', false],
  ['street', 'Street address', 'text', false],
  ['city', 'City', 'text', false],
  ['postal_code', 'Postal code', 'text', false],
  ['country', 'Country', 'text', false],
];

const AUTOCOMPLETE = { name: 'name', email: 'email', password: 'new-password', phone: 'tel', street: 'street-address', city: 'address-level2', postal_code: 'postal-code', country: 'country-name' };

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(Object.fromEntries(FIELDS.map(([k]) => [k, ''])));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try { await register(form); navigate('/'); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-md rounded-lg border bg-white p-6">
      <h1 className="mb-4 text-xl font-semibold">Create account</h1>
      {error && <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      <form onSubmit={submit} className="space-y-3">
        {FIELDS.map(([key, label, type, required]) => (
          <label key={key} className="block text-sm font-medium">
            <span className="mb-1 block">{label}{!required && " (optional)"}</span>
            <input type={type} required={required} autoComplete={AUTOCOMPLETE[key]} className="w-full rounded border p-2"
              value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
          </label>
        ))}
        <button disabled={busy} className="w-full rounded bg-orange-600 p-2 text-white hover:bg-orange-700 disabled:opacity-50">
          {busy ? 'Creating…' : 'Register'}
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-500">Already registered? <Link to="/login" className="text-orange-600 underline">Login</Link></p>
    </div>
  );
}
