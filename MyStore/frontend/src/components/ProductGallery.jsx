import { useEffect, useState } from 'react';

// Big image with hover zoom, thumbnails, and a full-screen viewer (click the image; arrow keys and Esc work)
export default function ProductGallery({ images, name }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState({ on: false, x: 50, y: 50 });
  const [light, setLight] = useState(false);
  const count = images.length;

  useEffect(() => { setIndex(0); }, [images]);

  useEffect(() => {
    if (!light) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setLight(false);
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % count);
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + count) % count);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [light, count]);

  if (!count) {
    return <div className="flex aspect-square items-center justify-center rounded bg-slate-100 text-slate-400">No image</div>;
  }

  const move = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setZoom({ on: true, x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };

  return (
    <div>
      <div className="relative aspect-square cursor-zoom-in overflow-hidden rounded border bg-white"
        onMouseMove={move} onMouseLeave={() => setZoom((z) => ({ ...z, on: false }))} onClick={() => setLight(true)}>
        <img src={images[index]} alt={name} className="h-full w-full object-contain transition-transform duration-150"
          style={{ transform: zoom.on ? 'scale(2)' : 'none', transformOrigin: `${zoom.x}% ${zoom.y}%` }} />
        <span className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/50 px-2 py-0.5 text-xs text-white">Click to enlarge</span>
      </div>

      {count > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button key={src + i} onClick={() => setIndex(i)} onMouseEnter={() => setIndex(i)}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded border-2 bg-white ${i === index ? 'border-orange-600' : 'border-transparent hover:border-slate-300'}`}>
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {light && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setLight(false)}>
          <button onClick={() => setLight(false)} aria-label="Close" className="absolute right-4 top-4 text-3xl text-white">×</button>
          {count > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); setIndex((index - 1 + count) % count); }} aria-label="Previous"
                className="absolute left-3 top-1/2 h-11 w-11 -translate-y-1/2 rounded-full bg-white/20 text-2xl text-white hover:bg-white/30">‹</button>
              <button onClick={(e) => { e.stopPropagation(); setIndex((index + 1) % count); }} aria-label="Next"
                className="absolute right-3 top-1/2 h-11 w-11 -translate-y-1/2 rounded-full bg-white/20 text-2xl text-white hover:bg-white/30">›</button>
            </>
          )}
          <img src={images[index]} alt={name} onClick={(e) => e.stopPropagation()} className="max-h-[90vh] max-w-full rounded object-contain" />
          <p className="absolute bottom-4 text-sm text-white/80">{index + 1} / {count}</p>
        </div>
      )}
    </div>
  );
}
