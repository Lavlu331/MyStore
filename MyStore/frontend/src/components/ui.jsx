export const btn = 'rounded bg-orange-600 px-3 py-1.5 text-sm text-white hover:bg-orange-700 disabled:opacity-50';
export const btnGhost = 'rounded border bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50';
export const inputCls = 'w-full rounded border bg-white p-2 text-sm';
export const humanize = (k) => k.replaceAll('_', ' ');

export const Alert = ({ type = 'error', children }) =>
  children ? (
    <p className={`mb-3 rounded p-2 text-sm ${type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{children}</p>
  ) : null;

// Shows any array of objects as a table (columns come from the first row)
export function DataTable({ rows }) {
  if (!rows || !rows.length) return <p className="text-sm text-slate-500">No data.</p>;
  const cols = Object.keys(rows[0]);
  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-slate-50 text-left text-slate-500">
            {cols.map((c) => <th key={c} className="whitespace-nowrap px-3 py-2 font-medium capitalize">{humanize(c)}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b last:border-0">
              {cols.map((c) => <td key={c} className="whitespace-nowrap px-3 py-2">{r[c] === null || r[c] === undefined ? '—' : String(r[c])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pager({ page, total, limit, onChange }) {
  const pages = Math.max(Math.ceil(total / limit), 1);
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-3 text-sm">
      <button disabled={page <= 1} onClick={() => onChange(page - 1)} className={btnGhost}>Previous</button>
      <span>Page {page} of {pages}</span>
      <button disabled={page >= pages} onClick={() => onChange(page + 1)} className={btnGhost}>Next</button>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {tabs.map(([key, label]) => (
        <button key={key} onClick={() => onChange(key)}
          className={`rounded-full px-3 py-1 text-sm ${value === key ? 'bg-orange-600 text-white' : 'border bg-white hover:bg-slate-50'}`}>
          {label}
        </button>
      ))}
    </div>
  );
}
