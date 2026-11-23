import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Avatar from './Avatar.jsx';

const GROUPS = [
  { title: 'Manage My Account', links: [
    ['/account', 'Overview'], ['/profile', 'My Profile'], ['/account/addresses', 'Address Book'],
    ['/account/vouchers', 'My Vouchers'], ['/account/security', 'Login & Security'],
  ] },
  { title: 'My Orders', links: [
    ['/orders', 'My Orders'], ['/orders?status=active', 'Track Orders'],
    ['/orders?status=cancelled', 'My Cancellations'], ['/orders?status=returned', 'My Returns'],
  ] },
  { title: 'My Activity', links: [['/account/reviews', 'My Reviews'], ['/wishlist', 'My Wishlist']] },
];
const SPECIAL = ['active', 'cancelled', 'returned'];

function isActive(to, pathname, search) {
  const [path, query] = to.split('?');
  if (path === '/orders') {
    if (!pathname.startsWith('/orders')) return false;
    const wanted = new URLSearchParams(query || '').get('status');
    const current = new URLSearchParams(search).get('status');
    if (pathname !== '/orders') return !wanted;                    // an order page belongs to "My Orders"
    return wanted ? current === wanted : !SPECIAL.includes(current);
  }
  return pathname === path;
}

export default function AccountLayout({ title, children }) {
  const { user } = useAuth();
  const { pathname, search } = useLocation();
  const staff = user && ['admin', 'inventory_manager'].includes(user.role);

  return (
    <div className="grid gap-4 md:grid-cols-[240px_1fr]">
      <aside className="h-fit rounded-xl bg-white p-3 text-sm shadow-sm">
        <Link to="/account" className="mb-3 hidden items-center gap-3 border-b px-2 pb-3 md:flex">
          <Avatar user={user} size="h-12 w-12" text="text-xl" />
          <div className="min-w-0"><p className="text-xs text-slate-500">Hello,</p><p className="truncate font-semibold">{user.name}</p></div>
        </Link>
        <nav className="flex gap-4 overflow-x-auto md:block md:space-y-4">
          {GROUPS.map((g) => (
            <div key={g.title} className="flex shrink-0 items-center gap-1 md:block">
              <p className="hidden px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 md:block">{g.title}</p>
              {g.links.map(([to, label]) => (
                <Link key={to} to={to}
                  className={`block whitespace-nowrap rounded-lg px-3 py-1.5 ${isActive(to, pathname, search) ? 'bg-orange-50 font-semibold text-orange-700' : 'text-slate-600 hover:bg-gray-50 hover:text-orange-600'}`}>{label}</Link>
              ))}
            </div>
          ))}
          {staff && <Link to="/admin" className="block shrink-0 whitespace-nowrap rounded-lg border-t px-3 py-2 text-slate-600 hover:text-orange-600 md:pt-3">Admin panel</Link>}
        </nav>
      </aside>
      <section className="min-w-0">
        {title && <h1 className="mb-3 text-xl font-semibold">{title}</h1>}
        {children}
      </section>
    </div>
  );
}
