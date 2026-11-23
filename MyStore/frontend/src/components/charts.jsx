// Small charts drawn with plain SVG (no chart library needed)

// Vertical bars. data: [{ label, value, tip }]
export function BarChart({ data, format = (v) => String(v), height = 190 }) {
  const W = 640;
  const H = height;
  const padL = 8; const padB = 22; const padT = 20;
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = Math.max(data.length, 1);
  const slot = (W - padL * 2) / n;
  const bw = Math.min(30, slot * 0.62);
  const labelEvery = n > 16 ? Math.ceil(n / 10) : 1;
  const plotH = H - padT - padB;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Bar chart">
      {[0, 0.5, 1].map((t) => (
        <line key={t} x1={padL} x2={W - padL} y1={padT + plotH * (1 - t)} y2={padT + plotH * (1 - t)} stroke="#e2e8f0" strokeDasharray={t === 0 ? '' : '4 4'} />
      ))}
      <text x={padL} y={12} fontSize="10" fill="#94a3b8">{format(max)}</text>
      {data.map((d, i) => {
        const h = plotH * (d.value / max);
        const x = padL + slot * i + (slot - bw) / 2;
        const y = H - padB - h;
        return (
          <g key={d.label + i}>
            <title>{d.tip}</title>
            <rect x={x} y={y} width={bw} height={d.value > 0 ? Math.max(h, 2) : 0} rx="3" className="fill-orange-500 hover:fill-orange-700" />
            {i % labelEvery === 0 && <text x={x + bw / 2} y={H - 7} textAnchor="middle" fontSize="10" fill="#94a3b8">{d.label}</text>}
          </g>
        );
      })}
    </svg>
  );
}

// Horizontal bars. rows: [{ label, value, color }]
export function HBars({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-sm">
          <span className="w-24 shrink-0 capitalize text-slate-600">{r.label}</span>
          <div className="h-3 flex-1 overflow-hidden rounded bg-slate-100">
            <div className={`h-full rounded ${r.color}`} style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          <span className="w-8 text-right font-medium">{r.value}</span>
        </div>
      ))}
    </div>
  );
}
