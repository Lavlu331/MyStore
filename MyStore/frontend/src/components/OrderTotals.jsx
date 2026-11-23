import { money } from '../config';

const Row = ({ label, value }) => (
  <div className="flex justify-between"><span className="text-slate-600">{label}</span><span>{value}</span></div>
);

// Shows subtotal, discount and delivery when they exist; older orders just show the total
export default function OrderTotals({ order }) {
  const discount = Number(order.discount_amount || 0);
  const delivery = Number(order.delivery_charge || 0);
  const detailed = discount > 0 || delivery > 0;
  return (
    <div className="ml-auto mt-3 w-full max-w-xs space-y-1 text-sm">
      {detailed && (
        <>
          <Row label="Subtotal" value={money(order.subtotal ?? order.total_amount)} />
          {discount > 0 && <Row label={`Discount${order.coupon_code ? ` (${order.coupon_code})` : ''}`} value={`-${money(discount)}`} />}
          <Row label="Delivery" value={delivery > 0 ? money(delivery) : 'Free'} />
        </>
      )}
      <div className="flex justify-between border-t pt-1 text-lg font-semibold"><span>Total</span><span>{money(order.total_amount)}</span></div>
    </div>
  );
}
