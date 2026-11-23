// − 1 + control; the value always stays between 1 and max
export default function QuantityInput({ value, onChange, max }) {
  const clamp = (n) => Math.min(Math.max(Number(n) || 1, 1), max);
  return (
    <div className="inline-flex items-center overflow-hidden rounded border bg-white">
      <button type="button" onClick={() => onChange(clamp(value - 1))} disabled={value <= 1}
        className="h-9 w-9 text-lg hover:bg-slate-100 disabled:opacity-40" aria-label="Decrease">−</button>
      <input value={value} onChange={(e) => onChange(clamp(e.target.value))} inputMode="numeric"
        className="h-9 w-12 border-x text-center outline-none" aria-label="Quantity" />
      <button type="button" onClick={() => onChange(clamp(value + 1))} disabled={value >= max}
        className="h-9 w-9 text-lg hover:bg-slate-100 disabled:opacity-40" aria-label="Increase">+</button>
    </div>
  );
}
