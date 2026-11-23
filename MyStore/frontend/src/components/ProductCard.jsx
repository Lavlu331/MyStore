import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { money } from '../config';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import { BagIcon, BoltIcon, BoxIcon, HeartIcon } from './icons.jsx';
import { Stars } from './Stars.jsx';

export default function ProductCard({ product: p }) {
  const { user } = useAuth();
  const { refresh } = useCart();
  const { ids, toggle } = useWishlist();
  const navigate = useNavigate();
  const [msg, setMsg] = useState('');

  const flash = (text) => { setMsg(text); setTimeout(() => setMsg(''), 2000); };
  const add = async () => {
    if (!user) { navigate('/login'); return; }
    try {
      await api('/cart/items', { method: 'POST', body: { product_id: p.id, quantity: 1 } });
      await refresh(); flash('Added to cart ✓');
    } catch (e) { flash(e.message); }
  };
  const heart = async () => {
    if (!user) { navigate('/login'); return; }
    try { await toggle(p.id); } catch (e) { flash(e.message); }
  };

  const hasDeal = Number(p.final_price) < Number(p.price);
  const percent = hasDeal ? Math.round((1 - Number(p.final_price) / Number(p.price)) * 100) : 0;
  const isFlash = p.flash_seconds_left !== null && p.flash_seconds_left !== undefined;
  const liked = ids.has(p.id);
  const stock = Number(p.total_stock);
  const inStock = stock > 0;
  const sold = Number(p.sold) || 0;

  return (
    <div className="store-product group flex flex-col overflow-hidden bg-white">
      <div className="store-product-media relative">
        <Link to={`/products/${p.id}`} aria-label={`View ${p.name}`}>
          {p.image
            ? <img src={p.image} alt={p.name} loading="lazy" className="aspect-square w-full object-contain p-3 transition duration-300 group-hover:scale-105" />
            : <div className="flex aspect-square items-center justify-center gap-1 flex-col text-sm text-violet-700"><BoxIcon className="size-8 text-violet-400" /><span>Photo unavailable</span></div>}
        </Link>
        {percent > 0 && <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-orange-700 px-2 py-1 text-xs font-bold text-white">{isFlash && <BoltIcon className="size-3" />}-{percent}%</span>}
        {!inStock && <div className="pointer-events-none absolute inset-x-2 bottom-2 rounded-full bg-white/95 px-2 py-1 text-center text-xs font-semibold text-slate-700">Out of stock</div>}
        <button onClick={heart} aria-label={liked ? 'Remove from wishlist' : 'Add to wishlist'} aria-pressed={liked}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-lg shadow hover:bg-white">
          <HeartIcon className={liked ? 'size-4 fill-violet-600 text-violet-600' : 'size-4 text-violet-700'} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3 sm:p-4">
        <Link to={`/products/${p.id}`} className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-slate-800 hover:text-orange-600">{p.name}</Link>
        <p className="text-xs text-slate-500">{p.category_name && `${p.category_name} · `}Item #{p.id}</p>
        <p className="text-lg font-semibold leading-tight text-orange-600">{money(p.final_price)}</p>
        {hasDeal && <p className="text-xs text-slate-400 line-through">{money(p.price)}</p>}
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
          {p.rating_count > 0 && <Stars value={p.rating_avg} count={p.rating_count} />}
          {sold > 0 && <span>{sold} sold</span>}
        </div>
        {inStock && stock <= 5 && <p className="text-xs font-medium text-red-600">Only {stock} left</p>}
        <button disabled={!inStock} onClick={add}
          className="store-card-action mt-auto">
          <BagIcon className="size-4 shrink-0" /> <span aria-live="polite">{msg || 'Add to cart'}</span>
        </button>
      </div>
    </div>
  );
}
