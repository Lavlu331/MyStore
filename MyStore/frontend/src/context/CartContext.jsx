import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from './AuthContext.jsx';

const CartContext = createContext(null);
const EMPTY = { items: [], total: '0.00' };

export function CartProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [state, setState] = useState({ cart: EMPTY, status: 'loading' });
  const latestRequest = useRef(0);

  const refresh = useCallback(async () => {
    if (userId == null) return;
    const request = ++latestRequest.current;
    setState((previous) => ({ userId, cart: previous.userId === userId ? previous.cart : EMPTY, status: 'loading' }));
    try {
      const cart = await api('/cart');
      if (request === latestRequest.current) setState({ userId, cart, status: 'ready' });
    } catch {
      if (request === latestRequest.current) setState((previous) => ({ ...previous, status: 'error' }));
    }
  }, [userId]);

  useEffect(() => {
    if (userId == null) setState({ cart: EMPTY, status: 'loading' });
    else refresh();
    return () => { latestRequest.current++; };
  }, [refresh, userId]);

  const { cart, status } = state.userId === userId ? state : { cart: EMPTY, status: 'loading' };
  const count = cart.items.reduce((sum, i) => sum + i.quantity, 0);
  return <CartContext.Provider value={{ cart, count, refresh, status }}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
