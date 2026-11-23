const Svg = ({ children, className = 'h-6 w-6' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    className={className} aria-hidden="true">{children}</svg>
);

export const SearchIcon = (p) => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>;
export const CartIcon = (p) => <Svg {...p}><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M2 3h3l2.7 12.4a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20 7H6" /></Svg>;
export const HeartIcon = (p) => <Svg {...p}><path d="M12 21s-7-4.6-9.3-9A5.4 5.4 0 0 1 12 6a5.4 5.4 0 0 1 9.3 6c-2.3 4.4-9.3 9-9.3 9z" /></Svg>;
export const UserIcon = (p) => <Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Svg>;
export const HomeIcon = (p) => <Svg {...p}><path d="M3 11 12 3l9 8" /><path d="M5 10v10h14V10" /></Svg>;
export const GridIcon = (p) => <Svg {...p}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></Svg>;
export const MenuIcon = (p) => <Svg {...p}><path d="M4 6h16M4 12h16M4 18h16" /></Svg>;
export const ChevronIcon = (p) => <Svg {...p}><path d="m9 6 6 6-6 6" /></Svg>;

export const BrandIcon = (p) => <Svg {...p}><path d="M12 2v20M2 12h20M5 5l14 14M19 5 5 19" /></Svg>;
export const BagIcon = (p) => <Svg {...p}><path d="M5 8h14l2 13H3L5 8Z" /><path d="M9 10V6a3 3 0 0 1 6 0v4" /></Svg>;
export const BoltIcon = (p) => <Svg {...p}><path d="m13 2-9 12h7l-1 8 10-12h-7l1-8z" /></Svg>;
export const WalletIcon = (p) => <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 9h18m-14 6h4" /></Svg>;
export const TruckIcon = (p) => <Svg {...p}><path d="M2 5h13v12H2zM15 9h4l3 4v4h-7" /><circle cx="6.5" cy="18" r="2" fill="var(--icon-surface, white)" /><circle cx="18" cy="18" r="2" fill="var(--icon-surface, white)" /></Svg>;
export const BoxIcon = (p) => <Svg {...p}><path d="m12 3 9 4.5v9L12 21l-9-4.5v-9L12 3Zm0 9L3 7.5m9 4.5 9-4.5M12 12v9" /></Svg>;
export const LinkIcon = (p) => <Svg {...p}><path d="M10 13a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-2 2m3 5a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l2-2" /></Svg>;
