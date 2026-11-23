import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { dateTime, money } from '../../config';
import { BarChart, HBars } from '../../components/charts.jsx';
import { Alert } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { StatusBadge } from '../Orders.jsx';

const STATUS_COLOR = {
  pending: 'bg-yellow-400', confirmed: 'bg-blue-400', processing: 'bg-orange-400', shipped: 'bg-purple-400',
  delivered: 'bg-green-500', cancelled: 'bg-red-400', returned: 'bg-slate-400',
};
const STATUS_ORDER = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

function Kpi({ label, value, sub, icon, tone = 'text-slate-800', to }) {
  const body = (
    <div className="h-full rounded-lg bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-50 text-lg">{icon}</span>
      </div>
      <p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

const Card = ({ title, action, children, className = '' }) => (
  <section className={`rounded-lg bg-white p-4 shadow-sm ${className}`}>
    <div className="mb-3 flex items-center justify-between">
      <h2 className="font-semibold text-slate-800">{title}</h2>
      {action}
    </div>
    {children}
  </section>
);

const Skeleton = () => (
  <div className="animate-pulse space-y-4">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-28 rounded-lg bg-slate-200" />)}</div>
    <div className="h-64 rounded-lg bg-slate-200" />
  </div>
);

const ACTIONS = [
  ['/admin/products/new', '＋', 'New product'], ['/admin/coupons', '🏷️', 'New coupon'], ['/admin/flash-sales', '⚡', 'New flash sale'],
  ['/admin/banners', '🖼️', 'Banners'], ['/admin/inventory', '🏬', 'Add stock'], ['/admin/reports', '📈', 'Reports'],
];

export default function Dashboard() {
  const { user } = useAuth();
  const [days, setDays] = useState(14);
  const [d, setD] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    api(`/reports/overview?days=${days}`).then(setD).catch((e) => setError(e.message));
  }, [days]);

  if (error) return <Alert>{error}</Alert>;
  if (!d) return <Skeleton />;

  const { kpi } = d;
  const change = kpi.revenue_prev_month > 0 ? ((kpi.revenue_month - kpi.revenue_prev_month) / kpi.revenue_prev_month) * 100 : null;
  const statusRows = STATUS_ORDER.map((s) => ({ label: s, value: d.statuses.find((x) => x.status === s)?.count || 0, color: STATUS_COLOR[s] }))
    .filter((r) => r.value > 0);
  const chart = d.daily.map((x) => ({
    label: x.day.slice(8), value: x.revenue,
    tip: `${x.day}: ${money(x.revenue)} from delivered orders, ${x.orders} order${x.orders === 1 ? '' : 's'} placed`,
  }));
  const periodRevenue = d.daily.reduce((s, x) => s + x.revenue, 0);
  const periodOrders = d.daily.reduce((s, x) => s + x.orders, 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{greeting()}, {user.name.split(' ')[0]} 👋</h1>
        <p className="text-sm text-slate-500">Here is what is happening in your store.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Revenue this month" icon="💰" value={money(kpi.revenue_month)} to="/admin/reports"
          sub={change === null ? 'Delivered orders' : <span className={change >= 0 ? 'text-green-600' : 'text-red-600'}>{change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(0)}% vs last month</span>} />
        <Kpi label="Orders today" icon="🛒" value={kpi.orders_today} sub={`${kpi.total_orders} orders in total`} to="/admin/orders" />
        <Kpi label="Pending orders" icon="⏳" value={kpi.pending_orders} tone={kpi.pending_orders > 0 ? 'text-orange-600' : 'text-slate-800'}
          sub={kpi.pending_orders > 0 ? 'Waiting for you to confirm' : 'Nothing waiting'} to="/admin/orders?status=pending" />
        <Kpi label="Low stock items" icon="📉" value={kpi.low_stock_count} tone={kpi.low_stock_count > 0 ? 'text-red-600' : 'text-slate-800'}
          sub={kpi.low_stock_count > 0 ? 'Time to restock' : 'Stock levels are fine'} to="/admin/inventory?low=true" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[['Revenue today', money(kpi.revenue_today)], ['Total revenue', money(kpi.revenue_total)], ['Customers', kpi.customers], ['Active products', kpi.active_products]].map(([l, v]) => (
          <div key={l} className="rounded-lg bg-white px-4 py-3 shadow-sm"><p className="text-xs text-slate-500">{l}</p><p className="font-semibold">{v}</p></div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" title={`Revenue, last ${days} days`}
          action={<div className="flex gap-1 text-xs">{[14, 30].map((n) => (
            <button key={n} onClick={() => setDays(n)} className={`rounded-full px-3 py-1 ${days === n ? 'bg-orange-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>{n} days</button>
          ))}</div>}>
          <BarChart data={chart} format={money} />
          <p className="mt-1 text-xs text-slate-500">{money(periodRevenue)} from delivered orders · {periodOrders} orders placed in this period. Hover a bar for the day.</p>
        </Card>

        <Card title="Orders by status" action={<Link to="/admin/orders" className="text-xs text-orange-600 hover:underline">All orders</Link>}>
          {statusRows.length ? <HBars rows={statusRows} /> : <p className="py-6 text-center text-sm text-slate-500">No orders yet.</p>}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Recent orders" action={<Link to="/admin/orders" className="text-xs text-orange-600 hover:underline">View all</Link>}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs text-slate-500"><th className="py-2">Order</th><th>Customer</th><th>Date</th><th>Status</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {d.recent_orders.map((o) => (
                  <tr key={o.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2"><Link to={`/admin/orders/${o.id}`} className="font-medium text-orange-600 hover:underline">#{o.id}</Link></td>
                    <td>{o.customer_name}</td>
                    <td className="whitespace-nowrap text-xs text-slate-500">{dateTime(o.created_at)}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td className="text-right font-medium">{money(o.total_amount)}</td>
                  </tr>
                ))}
                {!d.recent_orders.length && <tr><td colSpan="5" className="py-6 text-center text-slate-500">No orders yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Top selling products">
          <ol className="space-y-3">
            {d.top_products.map((p, i) => (
              <li key={`${p.product_id}-${p.name}`} className="flex items-center gap-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="text-right"><span className="block font-medium">{p.units} sold</span><span className="text-xs text-slate-500">{money(p.revenue)}</span></span>
              </li>
            ))}
            {!d.top_products.length && <li className="py-6 text-center text-sm text-slate-500">No sales yet.</li>}
          </ol>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Low stock" action={<Link to="/admin/inventory" className="text-xs text-orange-600 hover:underline">Open inventory</Link>}>
          <ul className="space-y-2 text-sm">
            {d.low_stock.map((s) => (
              <li key={`${s.product_id}-${s.warehouse_name}`} className="flex items-center justify-between gap-2">
                <span className="min-w-0"><span className="block truncate">{s.product_name}</span><span className="text-xs text-slate-500">{s.warehouse_name}</span></span>
                <span className="shrink-0 rounded bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">{s.quantity} left (min {s.low_stock_threshold})</span>
              </li>
            ))}
            {!d.low_stock.length && <li className="py-6 text-center text-slate-500">✅ Every product is well stocked.</li>}
          </ul>
        </Card>

        <Card className="xl:col-span-2" title="Quick actions">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {ACTIONS.map(([to, icon, label]) => (
              <Link key={label} to={to} className="flex items-center gap-3 rounded-lg border px-3 py-3 text-sm font-medium hover:border-orange-400 hover:bg-orange-50">
                <span className="text-xl">{icon}</span>{label}
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
