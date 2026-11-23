import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { money } from '../config';
import BannerCarousel from '../components/BannerCarousel.jsx';
import Countdown from '../components/Countdown.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { BagIcon, BoltIcon, BoxIcon, TruckIcon, WalletIcon } from '../components/icons.jsx';
import { getCategories } from '../lib/categories.js';

function ProductSection({ title, items, to }) {
  if (!items?.length) return null;
  return (
    <section className="store-section">
      <div className="store-section-heading">
        <h2>{title}</h2>
        <Link to={to} className="store-text-link">Shop all</Link>
      </div>
      <div className="store-product-grid">
        {items.slice(0, 6).map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </section>
  );
}

export default function Home() {
  const [data, setData] = useState(null);
  const [cats, setCats] = useState([]);
  const [banners, setBanners] = useState([]);
  const [settings, setSettings] = useState(null);
  const [flash, setFlash] = useState(null);
  const [error, setError] = useState('');
  const [feed, setFeed] = useState({ items: [], page: 0, totalPages: 1, loading: false });

  const loadFlash = useCallback(() => { api('/flash-sales/active?limit=12').then(setFlash).catch(() => {}); }, []);
  const loadFeed = useCallback(async (page) => {
    setFeed((previous) => ({ ...previous, loading: true }));
    try {
      const result = await api(`/products?sort=newest&page=${page}&limit=12`);
      setFeed((previous) => ({
        items: page === 1 ? result.products : [...previous.items, ...result.products],
        page, totalPages: result.totalPages, loading: false,
      }));
    } catch {
      setFeed((previous) => ({ ...previous, loading: false }));
    }
  }, []);

  useEffect(() => {
    loadFlash();
    loadFeed(1);
    api('/products/featured').then(setData).catch((e) => setError(e.message));
    getCategories().then(setCats).catch(() => {});
    api('/banners').then(setBanners).catch(() => {});
    api('/settings/public').then(setSettings).catch(() => {});
  }, [loadFlash, loadFeed]);

  const freeDelivery = Number(settings?.free_delivery_threshold) > 0;

  return (
    <div className="store-home">
      <section className="store-hero">
        <img className="store-hero-art" src="/storefront-hero.jpg" alt="" fetchPriority="high" />
        <div className="store-hero-copy">
          <h1>Good finds.<br /><em>Every day.</em></h1>
          <p>Discover tech, accessories and everyday essentials in one place.</p>
          <div className="store-hero-actions">
            <Link to="/shop" className="store-button store-button-lime"><BagIcon className="size-5" /> Explore the shop</Link>
            <Link to="/shop?sort=newest" className="store-button store-button-ghost">New arrivals</Link>
          </div>
        </div>
      </section>

      <div className="store-perks">
        <div><span><WalletIcon /></span><div><strong>Cash on delivery</strong><p>Pay when your order arrives</p></div></div>
        <div><span><TruckIcon /></span><div><strong>{freeDelivery ? `Free delivery over ${money(settings.free_delivery_threshold)}` : 'Delivery to your door'}</strong><p>Follow your order from your account</p></div></div>
        <Link to="/flash-sale"><span><BoltIcon /></span><div><strong>Flash sales</strong><p>Browse limited-time offers</p></div></Link>
      </div>

      {cats.length > 0 && <section className="store-section" aria-labelledby="category-title">
        <div className="store-section-heading">
          <h2 id="category-title">Explore categories</h2>
          <Link to="/shop" className="store-text-link">All products</Link>
        </div>
        <div className="store-category-list">
          {cats.map((c) => (
            <Link key={c.id} to={`/shop?category=${c.id}`} className="store-category">
              <span>{c.image ? <img src={c.image} alt="" loading="lazy" /> : <BoxIcon />}</span>{c.name}
            </Link>
          ))}
        </div>
      </section>}

      {banners.length > 0 && <BannerCarousel banners={banners} />}

      {flash?.sale && flash.products.length > 0 && (
        <section className="store-section store-flash">
          <div className="store-section-heading">
            <div className="flex flex-wrap items-center gap-3">
              <BoltIcon className="size-6" />
              <h2>{flash.sale.title}</h2>
              <span className="flex items-center gap-2 text-sm">Ends in <Countdown seconds={flash.sale.seconds_left} onEnd={loadFlash} /></span>
            </div>
            <Link to="/flash-sale" className="store-text-link">Shop sale</Link>
          </div>
          <div className="store-product-grid">
            {flash.products.slice(0, 6).map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}
      {flash && !flash.sale && flash.upcoming && (
        <div className="store-flash flex flex-wrap items-center gap-3 text-sm">
          <BoltIcon className="size-5" /><strong>{flash.upcoming.title}</strong> starts in
          <Countdown seconds={flash.upcoming.seconds_until_start} onEnd={loadFlash} />
        </div>
      )}

      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
      {!data && !error && <p role="status" className="py-8 text-center text-slate-500">Loading products…</p>}
      {data && (
        <>
          <ProductSection title="New arrivals" items={data.newArrivals} to="/shop?sort=newest" />
          <ProductSection title="Best sellers" items={data.bestSellers} to="/shop?sort=sold_desc" />
          <ProductSection title="Hot deals" items={data.onSale} to="/shop?sort=price_asc" />
        </>
      )}

      {feed.items.length > 0 && (
        <section className="store-section">
          <div className="store-section-heading">
            <h2>Browse the catalogue</h2>
          </div>
          <div className="store-product-grid">
            {feed.items.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
          {feed.page < feed.totalPages && (
            <div className="mt-6 text-center">
              <button onClick={() => loadFeed(feed.page + 1)} disabled={feed.loading}
                className="store-button store-button-outline disabled:opacity-50">
                {feed.loading ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
