import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import AccountLayout from '../components/AccountLayout.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';

export default function Wishlist() {
  const { ids } = useWishlist();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api('/wishlist').then(setItems).catch((e) => setError(e.message)); }, []);

  const visible = (items || []).filter((p) => ids.has(p.id));   // removed hearts disappear immediately

  return (
    <AccountLayout title="My wishlist">
      {error && <p className="text-red-600">{error}</p>}
      {!items && !error && <p className="py-10 text-center text-slate-500">Loading…</p>}
      {items && visible.length === 0 && (
        <div className="rounded bg-white py-14 text-center">
          <p className="text-5xl">♡</p>
          <p className="mt-2 font-semibold">Your wishlist is empty</p>
          <p className="text-sm text-slate-500">Tap the heart on a product to save it here.</p>
          <Link to="/shop" className="mt-3 inline-block rounded bg-orange-600 px-6 py-2 font-semibold text-white hover:bg-orange-700">Find something you like</Link>
        </div>
      )}
      {visible.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {visible.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </AccountLayout>
  );
}
