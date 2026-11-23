import { api } from '../api';

// Categories rarely change, so they are fetched once and shared by the header, home page and footer
let cache = null;
export const getCategories = () => {
  if (!cache) cache = api('/categories').catch((e) => { cache = null; throw e; });
  return cache;
};
