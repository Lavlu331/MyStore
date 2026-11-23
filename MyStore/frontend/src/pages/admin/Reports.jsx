import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext.jsx';
import { money } from '../../config';
import { Alert, DataTable, Tabs, btn, inputCls } from '../../components/ui.jsx';

const ALL = [
  ['sales', 'Sales by period', null, ['admin']],
  ['monthly', 'Monthly sales', '/reports/monthly-sales', ['admin']],
  ['best', 'Best sellers', '/reports/best-selling?limit=20', ['admin']],
  ['payments', 'Payments', '/reports/payments?limit=50', ['admin']],
  ['status', 'Order status', '/reports/order-status', ['admin']],
  ['inventory', 'Inventory', '/reports/inventory', ['admin', 'inventory_manager']],
  ['warehouse', 'By warehouse', '/reports/warehouse-stock', ['admin', 'inventory_manager']],
  ['low', 'Low stock', '/reports/low-stock', ['admin', 'inventory_manager']],
];

export default function Reports() {
  const { user } = useAuth();
  const tabs = ALL.filter(([, , , roles]) => roles.includes(user.role));
  const [tab, setTab] = useState(tabs[0][0]);
  const current = tabs.find(([k]) => k === tab);

  return (
    <div>
      <h1 className="mb-3 text-xl font-semibold">Reports</h1>
      <Tabs tabs={tabs.map(([k, l]) => [k, l])} value={tab} onChange={setTab} />
      {tab === 'sales' ? <SalesByPeriod /> : <Generic key={tab} path={current[2]} />}
    </div>
  );
}

function Generic({ path }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api(path).then(setRows).catch((e) => setError(e.message)); }, [path]);
  if (error) return <Alert>{error}</Alert>;
  if (!rows) return <p className="text-slate-500">Loading…</p>;
  return <DataTable rows={Array.isArray(rows) ? rows : [rows]} />;
}

function SalesByPeriod() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadReport = async (query = '') => {
    setError(''); setLoading(true);
    try {
      const report = await api(`/reports/sales${query}`);
      setData(report);
      setFrom(report.from);
      setTo(report.to);
    } catch (err) { setError(err.message); setData(null); } finally { setLoading(false); }
  };
  useEffect(() => { loadReport(); }, []);

  const exportCsv = () => {
    const csv = ['Date,Orders,Sales', ...data.daily.map((row) => `${row.day},${Number(row.orders)},${Number(row.sales).toFixed(2)}`)].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `sales-${data.from}-to-${data.to}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); loadReport(`?${new URLSearchParams({ from, to })}`); }} className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">From<input required type="date" max={to || undefined} className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-sm">To<input required type="date" min={from || undefined} className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <button disabled={loading} className={btn}>Show report</button>
      </form>
      <Alert>{error}</Alert>
      {loading && <p role="status" className="text-sm text-slate-500">Loading sales report…</p>}
      {data && !loading && (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600">{data.from} to {data.to} · Store time zone: {data.time_zone}</p>
            <button type="button" onClick={exportCsv} className={btn}>Export CSV</button>
          </div>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-white p-3"><p className="text-sm text-slate-500">Delivered orders</p><p className="text-xl font-semibold">{data.delivered_orders}</p></div>
            <div className="rounded-lg border bg-white p-3"><p className="text-sm text-slate-500">Total sales</p><p className="text-xl font-semibold">{money(data.total_sales)}</p></div>
            <div className="rounded-lg border bg-white p-3"><p className="text-sm text-slate-500">Average order</p><p className="text-xl font-semibold">{money(data.average_order_value)}</p></div>
          </div>
          <DataTable rows={data.daily.map((d) => ({ day: String(d.day).slice(0, 10), orders: d.orders, sales: money(d.sales) }))} />
        </>
      )}
    </div>
  );
}
