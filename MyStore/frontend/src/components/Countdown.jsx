import useCountdown from '../lib/useCountdown.js';

const two = (n) => String(n).padStart(2, '0');

// 02 : 14 : 33  (with a days box when more than a day is left). tone="light" for use on coloured backgrounds.
export default function Countdown({ seconds, onEnd, tone = 'dark' }) {
  const { d, h, m, s } = useCountdown(seconds, onEnd);
  const box = `rounded px-1.5 py-0.5 ${tone === 'light' ? 'bg-white text-orange-600' : 'bg-slate-900 text-white'}`;
  const sep = tone === 'light' ? 'text-white' : 'text-slate-700';
  return (
    <span className="inline-flex items-center gap-1 font-mono text-sm font-bold" aria-label="Time left">
      {d > 0 && <><span className={box}>{d}d</span><span className={sep}>:</span></>}
      <span className={box}>{two(h)}</span><span className={sep}>:</span>
      <span className={box}>{two(m)}</span><span className={sep}>:</span>
      <span className={box}>{two(s)}</span>
    </span>
  );
}
