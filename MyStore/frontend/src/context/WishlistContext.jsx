import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from './AuthContext.jsx';

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const { user } = useAuth();
  const [ids, setIds] = useState(new Set());

  const refresh = useCallback(async () => {
    if (!user) { setIds(new Set()); return; }
    try { setIds(new Set((await api('/wishlist')).map((p) => p.id))); } catch { /* ignore */ }
  }, [user]);
  useEffect(() => { refresh(); }, [refresh]);

  const toggle = async (productId) => {
    if (ids.has(productId)) await api(`/wishlist/${productId}`, { method: 'DELETE' });
    else await api('/wishlist', { method: 'POST', body: { product_id: productId } });
    await refresh();
  };

  return <WishlistContext.Provider value={{ ids, count: ids.size, toggle, refresh }}>{children}</WishlistContext.Provider>;
}

export const useWishlist = () => useContext(WishlistContext);
