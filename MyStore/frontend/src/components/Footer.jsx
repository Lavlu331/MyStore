import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BrandIcon, WalletIcon } from './icons.jsx';
import { getCategories } from '../lib/categories.js';

const col = 'space-y-2 text-sm text-slate-400';
const link = 'hover:text-white';

export default function Footer() {
  const [cats, setCats] = useState([]);
  useEffect(() => { getCategories().then(setCats).catch(() => {}); }, []);

  return (
    <footer className="store-footer mt-12 pb-20 text-slate-300 print:hidden md:pb-0">
      <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="block w-full store-footer-top py-3 text-center text-sm">Back to top</button>
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link to="/" className="store-brand text-white"><span aria-hidden="true"><BrandIcon className="size-5" /></span>MyStore</Link>
          <p className="mt-2 text-sm text-slate-400">Quality products, honest prices and cash on delivery, delivered to your door.</p>
        </div>
        <div>
          <p className="mb-3 font-semibold text-white">Customer care</p>
          <ul className={col}>
            <li><Link to="/orders" className={link}>My orders</Link></li>
            <li><Link to="/profile" className={link}>My profile</Link></li>
            <li><Link to="/wishlist" className={link}>My wishlist</Link></li>
            <li><Link to="/cart" className={link}>Shopping cart</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-3 font-semibold text-white">Shop</p>
          <ul className={col}>
            <li><Link to="/shop?sort=newest" className={link}>New arrivals</Link></li>
            <li><Link to="/shop?sort=sold_desc" className={link}>Best sellers</Link></li>
            <li><Link to="/shop?sort=rating_desc" className={link}>Top rated</Link></li>
            {cats.slice(0, 3).map((c) => <li key={c.id}><Link to={`/shop?category=${c.id}`} className={link}>{c.name}</Link></li>)}
          </ul>
        </div>
        <div>
          <p className="mb-3 font-semibold text-white">Payment</p>
          <p className="text-sm text-slate-400">Cash on delivery: pay when your order arrives.</p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-violet-400/40 px-3 py-1 text-sm"><WalletIcon className="size-4" /> Cash on delivery</p>
        </div>
      </div>
      <p className="border-t border-slate-800 py-4 text-center text-xs text-slate-500">© {new Date().getFullYear()} MyStore. All rights reserved.</p>
    </footer>
  );
}
