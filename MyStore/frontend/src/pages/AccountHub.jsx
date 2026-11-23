import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { money } from '../config';
import AccountLayout from '../components/AccountLayout.jsx';
import Avatar from '../components/Avatar.jsx';
import ProductCard from '../components/ProductCard.jsx';
import useBuyAgain from '../lib/buyAgain.js';
import { getRecent } from '../lib/recent.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { StatusBadge } from './Orders.jsx';

const ACTIVE = ['pending', 'confirmed', 'processing', 'shipped'];

function Tile({ to, icon, tint, title, text, badge }) {
  return (
    <Link to={to} className="group flex gap-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-orange-200">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ${tint}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="font-semibold text-slate-800 group-hover:text-orange-600">{title}</span>
          {badge !== undefined && badge !== null && badge !== '' && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">{badge}</span>}
        </span>
        <span className="mt-0.5 block text-sm text-slate-500">{text}</span>
      </span>
    </Link>
  );
}

const Stat = ({ label, value }) => (
  <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur"><p className="text-xl font-bold sm:text-2xl">{value}</p><p className="text-xs text-white/70">{label}</p></div>
);

export default function AccountHub() {
  const { user, logout } = useAuth();
  const { count: cartCount } = useCart();
  const navigate = useNavigate();
  const { buyAgain, busyId, error: buyError } = useBuyAgain();
  const [sum, setSum] = useState(null);
  const [orders, setOrders] = useState([]);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    api('/account/summary').then(setSum).catch(() => {});
    api('/orders').then((o) => setOrders(o.slice(0, 3))).catch(() => {});
    const ids = getRecent();
    if (ids.length) api(`/products/by-ids?ids=${ids.join(',')}`).then(setRecent).catch(() => {});
  }, []);

  const since = user.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long' }) : '';
  const n = (v) => (sum ? v : '–');

  return (
    <AccountLayout>
      {/* Hero */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-orange-700 p-5 text-white shadow-lg sm:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar user={user} size="h-20 w-20" text="text-3xl" ring="ring-4 ring-white/30" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white/70">Your Account</p>
            <h1 className="truncate text-2xl font-extrabold sm:text-3xl">{user.name}</h1>
            <p className="truncate text-sm text-white/80">{user.email}{since && <span className="ml-2 text-white/60">· Member since {since}</span>}</p>
          </div>
          <div className="flex gap-2">
            <Link to="/profile" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-50">Edit profile</Link>
            <button onClick={() => { logout(); navigate('/'); }} className="rounded-full border border-white/40 px-4 py-2 text-sm hover:bg-white/10">Sign out</button>
          </div>
        </div>
      </section>

      {/* Cards */}
      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Tile to="/orders" icon="📦" tint="bg-orange-50" title="Your Orders" text="Track, return or buy things again" badge={sum?.orders} />
        <Tile to="/orders?status=active" icon="🚚" tint="bg-blue-50" title="Track Orders" text={sum ? `${sum.active_orders} on their way to you` : 'See where your parcels are'} badge={sum?.active_orders || ''} />
        <Tile to="/account/addresses" icon="🏠" tint="bg-green-50" title="Address Book" text="Manage where we deliver" badge={sum?.addresses} />
      </section>

        <div className="mt-4 grid rounded-xl bg-slate-800 p-4 text-white grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Orders placed" value={n(sum?.orders)} />
          <Stat label="In progress" value={n(sum?.active_orders)} />
          <Stat label="Total spent" value={sum ? money(sum.spent) : '–'} />
          <Stat label="You saved with coupons" value={sum ? money(sum.saved) : '–'} />
        </div>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Tile to="/account/vouchers" icon="🏷️" tint="bg-red-50" title="My Vouchers" text="Coupons you can use right now" badge={sum?.vouchers || ''} />
        <Tile to="/account/reviews" icon="⭐" tint="bg-yellow-50" title="My Reviews" text={sum?.to_review ? `${sum.to_review} product${sum.to_review === 1 ? '' : 's'} waiting for your review` : 'Rate what you bought'} badge={sum?.to_review || ''} />
        <Tile to="/wishlist" icon="♡" tint="bg-pink-50" title="My Wishlist" text="Products you saved for later" badge={sum?.wishlist} />
        <Tile to="/cart" icon="🛒" tint="bg-purple-50" title="Your Cart" text={cartCount ? 'Ready when you are' : 'Your cart is empty'} badge={cartCount || ''} />
        <Tile to="/profile" icon="👤" tint="bg-slate-100" title="Personal Info" text="Name, photo, birthday and more" />
        <Tile to="/account/security" icon="🔒" tint="bg-teal-50" title="Login & Security" text="Password, devices and your data" />
      </section>

      {/* Recent orders with Track and Buy it again */}
      <section className="mt-5">
        <div className="mb-2 flex items-end justify-between"><h2 className="text-lg font-semibold">Recent orders</h2><Link to="/orders" className="text-sm text-orange-600 hover:underline">View all orders</Link></div>
        {buyError && <p className="mb-2 rounded bg-red-50 p-2 text-sm text-red-700">{buyError}</p>}
        <div className="grid gap-3 lg:grid-cols-3">
          {orders.map((o) => (
            <div key={o.id} className="flex flex-col rounded-xl bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between"><span className="font-semibold">Order #{o.id}</span><StatusBadge status={o.status} /></div>
              <div className="mb-3 flex gap-2">
                {(o.items || []).slice(0, 3).map((it, i) => (it.image ? <img key={i} src={it.image} alt="" className="h-14 w-14 rounded-lg border object-cover" /> : <span key={i} className="h-14 w-14 rounded-lg bg-slate-100" />))}
                <span className="ml-auto self-end text-right"><span className="block text-xs text-slate-500">{o.item_count} item{o.item_count === 1 ? '' : 's'}</span><span className="font-bold text-orange-600">{money(o.total_amount)}</span></span>
              </div>
              <div className="mt-auto flex gap-2 text-sm">
                {ACTIVE.includes(o.status)
                  ? <Link to={`/orders/${o.id}/track`} className="flex-1 rounded-lg bg-orange-600 py-1.5 text-center font-medium text-white hover:bg-orange-700">Track</Link>
                  : <Link to={`/orders/${o.id}`} className="flex-1 rounded-lg border py-1.5 text-center hover:bg-gray-50">Details</Link>}
                <button onClick={() => buyAgain(o.id)} disabled={busyId === o.id} className="flex-1 rounded-lg border border-orange-600 py-1.5 font-medium text-orange-600 hover:bg-orange-50 disabled:opacity-50">{busyId === o.id ? 'Adding…' : 'Buy it again'}</button>
              </div>
            </div>
          ))}
          {!orders.length && <p className="rounded-xl bg-white p-8 text-center text-slate-500 lg:col-span-3">No orders yet. <Link to="/shop" className="text-orange-600 underline">Start shopping</Link></p>}
        </div>
      </section>

      {recent.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 text-lg font-semibold">Recently viewed</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{recent.slice(0, 4).map((p) => <ProductCard key={p.id} product={p} />)}</div>
        </section>
      )}
    </AccountLayout>
  );
}
