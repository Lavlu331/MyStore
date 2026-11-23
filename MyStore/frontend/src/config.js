// Change the currency symbol here if needed
export const CURRENCY = '৳';
export const money = (v) => `${CURRENCY}${Number(v).toFixed(2)}`;
export const dateTime = (v) => new Date(v).toLocaleString();
