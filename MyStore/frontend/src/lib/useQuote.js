import { useEffect, useState } from 'react';
import { api } from '../api';

// Asks the server for subtotal, discount, delivery charge and total (the server does all the maths).
// If the coupon is rejected, onCouponRejected() is called so the page can drop it.
export default function useQuote(items, applied, onCouponRejected) {
  const [quote, setQuote] = useState(null);
  const [couponError, setCouponError] = useState('');
  const signature = items.map((i) => `${i.product_id}:${i.quantity}`).join(',');

  useEffect(() => {
    if (!items.length) return undefined;
    let alive = true;
    api('/cart/quote', { method: 'POST', body: { coupon_code: applied || undefined } })
      .then((q) => { if (alive) { setQuote(q); setCouponError(''); } })
      .catch((e) => {
        if (!alive) return;
        setCouponError(e.message);
        onCouponRejected?.();
        api('/cart/quote', { method: 'POST', body: {} }).then((q) => { if (alive) setQuote(q); }).catch(() => {});
      });
    return () => { alive = false; };
  }, [signature, applied]);   // eslint-disable-line react-hooks/exhaustive-deps

  return { quote, couponError };
}
