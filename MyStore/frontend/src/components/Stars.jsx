// Read-only stars, e.g. <Stars value={4.5} count={12} />
export function Stars({ value = 0, count, showNumber = false }) {
  const filled = Math.round(Number(value) || 0);
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span aria-label={`${Number(value).toFixed(1)} out of 5`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={i <= filled ? 'text-amber-500' : 'text-slate-300'}>★</span>
        ))}
      </span>
      {showNumber && <span className="font-medium">{Number(value).toFixed(1)}</span>}
      {count !== undefined && <span className="text-xs text-slate-500">({count})</span>}
    </span>
  );
}

// Clickable stars for the review form
export function StarInput({ value, onChange }) {
  return (
    <span className="inline-flex gap-1 text-2xl">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" onClick={() => onChange(i)} aria-label={`${i} star${i > 1 ? 's' : ''}`}
          className={i <= value ? 'text-amber-500' : 'text-slate-300 hover:text-amber-300'}>★</button>
      ))}
    </span>
  );
}
