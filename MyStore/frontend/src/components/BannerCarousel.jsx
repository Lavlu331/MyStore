import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

// Used when the admin has not added any banner yet
const DEFAULT_SLIDES = [
  { id: 'd1', title: 'Everything you need, delivered to your door', subtitle: 'Shop the latest products and pay on delivery', link_url: '/shop?sort=newest', gradient: 'from-orange-500 to-red-500' },
  { id: 'd2', title: 'Hot deals every day', subtitle: 'Save on discounted products', link_url: '/shop?sort=price_asc', gradient: 'from-slate-800 to-slate-600' },
];

function Slide({ slide }) {
  const body = slide.image_url ? (
    <img src={slide.image_url} alt={slide.title} className="h-full w-full object-cover" />
  ) : (
    <div className={`flex h-full flex-col justify-center bg-gradient-to-r ${slide.gradient || 'from-orange-500 to-red-500'} px-8 text-white sm:px-14`}>
      <h2 className="max-w-md text-2xl font-extrabold sm:text-4xl">{slide.title}</h2>
      {slide.subtitle && <p className="mt-2 max-w-md text-sm text-white/90 sm:text-base">{slide.subtitle}</p>}
      <span className="mt-4 w-fit rounded-full bg-white px-5 py-2 text-sm font-semibold text-orange-700">Shop now</span>
    </div>
  );
  if (!slide.link_url) return <div className="h-full">{body}</div>;
  return slide.link_url.startsWith('/')
    ? <Link to={slide.link_url} className="block h-full">{body}</Link>
    : <a href={slide.link_url} target="_blank" rel="noopener noreferrer" className="block h-full">{body}</a>;
}

export default function BannerCarousel({ banners }) {
  const slides = banners && banners.length ? banners : DEFAULT_SLIDES;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;

  useEffect(() => { setIndex(0); }, [count]);
  useEffect(() => {
    if (count < 2 || paused) return undefined;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), 5000);
    return () => clearInterval(t);
  }, [count, paused]);

  const go = (n) => setIndex((n + count) % count);

  return (
    <div className="group relative h-44 overflow-hidden rounded bg-slate-200 sm:h-60 lg:h-72"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="flex h-full transition-transform duration-500" style={{ transform: `translateX(-${index * 100}%)` }}>
        {slides.map((s) => <div key={s.id} className="h-full w-full shrink-0"><Slide slide={s} /></div>)}
      </div>
      {count > 1 && (
        <>
          <button onClick={() => go(index - 1)} aria-label="Previous"
            className="absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 rounded-full bg-black/40 text-xl text-white hover:bg-black/60 group-hover:block">‹</button>
          <button onClick={() => go(index + 1)} aria-label="Next"
            className="absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 rounded-full bg-black/40 text-xl text-white hover:bg-black/60 group-hover:block">›</button>
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
            {slides.map((s, i) => (
              <button key={s.id} onClick={() => setIndex(i)} aria-label={`Slide ${i + 1}`}
                className={`h-2 rounded-full transition-all ${i === index ? 'w-5 bg-white' : 'w-2 bg-white/60'}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
