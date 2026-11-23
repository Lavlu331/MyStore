// "Recently viewed" products are remembered in this browser only
const KEY = 'recently_viewed';

export const getRecent = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
};

export const addRecent = (id) => {
  try {
    const list = [id, ...getRecent().filter((x) => x !== id)].slice(0, 12);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch { /* storage may be blocked */ }
};
