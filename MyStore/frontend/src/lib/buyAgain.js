import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useCart } from '../context/CartContext.jsx';

// "Buy it again": puts the items of an earlier order back into the cart, then opens the cart
export default function useBuyAgain() {
  const navigate = useNavigate();
  const { refresh } = useCart();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const describe = (list) => list.map((s) => `${s.name} (${s.reason})`).join(', ');

  const buyAgain = async (orderId) => {
    setBusyId(orderId); setError('');
    try {
      const r = await api(`/orders/${orderId}/reorder`, { method: 'POST' });
      await refresh();
      if (!r.added.length) { setError(`Nothing could be added: ${describe(r.skipped)}`); return; }
      const units = r.added.reduce((n, a) => n + a.quantity, 0);
      const notice = `Added ${units} item${units === 1 ? '' : 's'} from order #${orderId} to your cart.${r.skipped.length ? ` Not added: ${describe(r.skipped)}.` : ''}`;
      navigate('/cart', { state: { notice } });
    } catch (e) { setError(e.message); } finally { setBusyId(null); }
  };

  return { buyAgain, busyId, error };
}
