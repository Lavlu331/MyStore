import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { BagIcon, GridIcon, HeartIcon, HomeIcon, UserIcon } from './icons.jsx';

// Phone-only tab bar fixed to the bottom of the screen (like shopping apps)
export default function BottomNav() {
  const { user } = useAuth();
  const { count } = useCart();
  const { pathname } = useLocation();
  if (pathname.startsWith('/products/')) return null;   // the product page has its own action bar

  const items = [
    ['/', 'Home', HomeIcon],
    ['/shop', 'Shop', GridIcon],
    ['/wishlist', 'Wishlist', HeartIcon],
    ['/cart', 'Cart', BagIcon],
    [user ? '/account' : '/login', user ? 'Account' : 'Login', UserIcon],
  ];

  return (
    <nav aria-label="Store navigation" className="store-bottom-nav fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 print:hidden md:hidden">
      {items.map(([to, label, Icon]) => {
        const active = to === '/account' ? ['/account', '/orders', '/profile'].some((prefix) => pathname.startsWith(prefix))
          : to === '/' ? pathname === '/' : pathname.startsWith(to);
        return (
          <Link key={label} to={to} aria-current={active ? 'page' : undefined} className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] ${active ? 'text-orange-600' : 'text-slate-500'}`}>
            <span className="store-tab-icon"><Icon className="size-5" /></span>
            {label}
            {label === 'Cart' && count > 0 && <span className="absolute right-4 top-1 rounded-full bg-orange-600 px-1.5 text-[10px] font-bold text-white">{count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
