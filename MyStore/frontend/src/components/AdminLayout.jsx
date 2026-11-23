import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext.jsx';

const ADMIN = ['admin'];
const BOTH = ['admin', 'inventory_manager'];

const NAV = [
  { title: 'Overview', items: [['/admin', 'Dashboard', '📊', ADMIN, true]] },
  { title: 'Catalog', items: [
    ['/admin/products', 'Products', '📦', ADMIN],
    ['/admin/categories', 'Categories', '🗂️', ADMIN],
    ['/admin/inventory', 'Inventory', '🏬', BOTH],
  ] },
  { title: 'Sales', items: [
    ['/admin/orders', 'Orders', '🧾', ADMIN],
    ['/admin/coupons', 'Coupons', '🏷️', ADMIN],
    ['/admin/flash-sales', 'Flash sales', '⚡', ADMIN],
    ['/admin/banners', 'Banners', '🖼️', ADMIN],
  ] },
  { title: 'People and insight', items: [
    ['/admin/users', 'Users', '👥', ADMIN],
    ['/admin/reports', 'Reports', '📈', BOTH],
  ] },
  { title: 'System', items: [['/admin/settings', 'Settings', '⚙️', ADMIN]] },
];

// Full-screen admin frame: dark sidebar (a slide-in drawer on phones) + top bar
export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    const load = () => api('/notifications/unread-count').then((d) => setUnread(d.unread)).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const sections = NAV
    .map((s) => ({ ...s, items: s.items.filter(([, , , roles]) => roles.includes(user.role)) }))
    .filter((s) => s.items.length);

  return (
    <div className="min-h-screen bg-gray-100 md:flex">
      {open && <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col overflow-y-auto bg-slate-900 text-slate-300 transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-5 py-4">
          <Link to="/admin" className="text-xl font-extrabold text-white">MyStore <span className="text-orange-500">Admin</span></Link>
          <button onClick={() => setOpen(false)} className="text-2xl leading-none text-slate-400 md:hidden" aria-label="Close menu">×</button>
        </div>
        <nav className="flex-1 space-y-4 px-3 pb-4">
          {sections.map((s) => (
            <div key={s.title}>
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{s.title}</p>
              {s.items.map(([to, label, icon, , end]) => (
                <NavLink key={to} to={to} end={end}
                  className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2 text-sm ${isActive ? 'bg-orange-600 font-medium text-white' : 'hover:bg-slate-800 hover:text-white'}`}>
                  <span className="w-5 text-center">{icon}</span>{label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-slate-800 p-3">
          <Link to="/" className="block rounded-md px-3 py-2 text-sm hover:bg-slate-800 hover:text-white">← View store</Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b bg-white px-4 py-3">
          <button onClick={() => setOpen(true)} className="rounded border px-2.5 py-1 text-lg md:hidden" aria-label="Open menu">☰</button>
          <p className="hidden text-sm text-slate-500 md:block">Signed in as <span className="font-medium text-slate-800">{user.name}</span> ({user.role.replace('_', ' ')})</p>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <Link to="/notifications" className="relative rounded px-2 py-1 hover:bg-gray-100">
              🔔{unread > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">{unread}</span>}
              <span className="ml-1 hidden sm:inline">Alerts</span>
            </Link>
            <button onClick={() => { logout(); navigate('/'); }} className="rounded border px-3 py-1 hover:bg-gray-50">Logout</button>
          </div>
        </header>
        <main className="min-w-0 p-4 md:p-6"><Outlet /></main>
      </div>
    </div>
  );
}
