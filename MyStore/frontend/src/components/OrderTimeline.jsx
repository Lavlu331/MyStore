import { dateTime } from '../config';

export default function OrderTimeline({ history }) {
  if (!history || !history.length) return <p className="text-sm text-slate-500">No progress recorded yet.</p>;
  return (
    <ol className="ml-3 border-l border-slate-300">
      {history.map((h, i) => {
        const last = i === history.length - 1;
        return (
          <li key={i} className="relative mb-4 ml-5 last:mb-0">
            <span className={`absolute -left-[26px] top-1.5 h-3 w-3 rounded-full ring-4 ring-white ${last ? 'bg-orange-600' : 'bg-slate-400'}`} />
            <p className={`font-medium capitalize ${last ? 'text-orange-700' : ''}`}>{h.status}</p>
            <p className="text-xs text-slate-500">{dateTime(h.created_at)}</p>
            {h.note && <p className="text-sm text-slate-600">{h.note}</p>}
          </li>
        );
      })}
    </ol>
  );
}
