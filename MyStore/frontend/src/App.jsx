import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import BottomNav from './components/BottomNav.jsx';
import AdminLayout from './components/AdminLayout.jsx';
import { useAuth } from './context/AuthContext.jsx';
import Home from './pages/Home.jsx';
import FlashSale from './pages/FlashSale.jsx';
import Products from './pages/Products.jsx';
import Wishlist from './pages/Wishlist.jsx';
import Profile from './pages/Profile.jsx';
import Addresses from './pages/Addresses.jsx';
import AccountHub from './pages/AccountHub.jsx';
import Security from './pages/Security.jsx';
import TrackOrder from './pages/TrackOrder.jsx';
import Vouchers from './pages/Vouchers.jsx';
import MyReviews from './pages/MyReviews.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import Orders from './pages/Orders.jsx';
import OrderDetail from './pages/OrderDetail.jsx';
import Notifications from './pages/Notifications.jsx';
import Dashboard from './pages/admin/Dashboard.jsx';
import AdminProducts from './pages/admin/AdminProducts.jsx';
import ProductForm from './pages/admin/ProductForm.jsx';
import AdminCategories from './pages/admin/AdminCategories.jsx';
import AdminOrders from './pages/admin/AdminOrders.jsx';
import AdminOrderDetail from './pages/admin/AdminOrderDetail.jsx';
import Inventory from './pages/admin/Inventory.jsx';
import Reports from './pages/admin/Reports.jsx';
import AdminUsers from './pages/admin/AdminUsers.jsx';
import AdminCoupons from './pages/admin/AdminCoupons.jsx';
import AdminBanners from './pages/admin/AdminBanners.jsx';
import AdminFlashSales from './pages/admin/AdminFlashSales.jsx';
import AdminSettings from './pages/admin/AdminSettings.jsx';
import Invoice from './pages/Invoice.jsx';

const PORTFOLIO_DEMO = import.meta.env.VITE_PORTFOLIO_DEMO === 'true';
const ADMIN = ['admin'];
const STAFF = ['admin', 'inventory_manager'];

// Requires login, and optionally one of the given roles (the backend checks roles too)
function Protected({ children, roles }) {
  const { user, loading, sessionError, restoreSession } = useAuth();
  const location = useLocation();
  if (loading) return <p className="p-8 text-center text-slate-500">Loading…</p>;
  if (sessionError) return (
    <div className="py-10 text-center">
      <p role="alert">Could not verify your session.</p>
      <button type="button" onClick={restoreSession} className="mt-3 rounded bg-orange-600 px-4 py-2 text-white">Try again</button>
    </div>
  );
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (roles && !roles.includes(user.role))
    return <p className="py-16 text-center text-red-600">You do not have permission to view this page.</p>;
  return children;
}

function AdminHome() {
  const { user } = useAuth();
  return user.role === 'admin' ? <Dashboard /> : <Navigate to="/admin/inventory" replace />;
}

export default function App() {
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith('/admin');   // the admin area has its own frame
  return (
    <div className={isAdmin ? undefined : 'storefront'}>
      {!isAdmin && <Navbar />}
      {!isAdmin && PORTFOLIO_DEMO && (
        <p className="print:hidden mx-auto max-w-7xl px-4 pt-3 text-center text-sm text-slate-600">
          Portfolio demo. Use sample contact details. Orders are for testing only.
        </p>
      )}
      <main className={isAdmin ? '' : 'store-main mx-auto min-h-[60vh] max-w-7xl px-4 py-5 sm:px-6 md:py-7'}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Products />} />
          <Route path="/flash-sale" element={<FlashSale />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/cart" element={<Protected><Cart /></Protected>} />
          <Route path="/checkout" element={<Protected><Checkout /></Protected>} />
          <Route path="/wishlist" element={<Protected><Wishlist /></Protected>} />
          <Route path="/profile" element={<Protected><Profile /></Protected>} />
          <Route path="/account" element={<Protected><AccountHub /></Protected>} />
          <Route path="/account/security" element={<Protected><Security /></Protected>} />
          <Route path="/account/addresses" element={<Protected><Addresses /></Protected>} />
          <Route path="/account/vouchers" element={<Protected><Vouchers /></Protected>} />
          <Route path="/account/reviews" element={<Protected><MyReviews /></Protected>} />
          <Route path="/orders" element={<Protected><Orders /></Protected>} />
          <Route path="/orders/:id" element={<Protected><OrderDetail /></Protected>} />
          <Route path="/orders/:id/invoice" element={<Protected><Invoice /></Protected>} />
          <Route path="/orders/:id/track" element={<Protected><TrackOrder /></Protected>} />
          <Route path="/notifications" element={<Protected roles={STAFF}><Notifications /></Protected>} />

          <Route path="/admin" element={<Protected roles={STAFF}><AdminLayout /></Protected>}>
            <Route index element={<AdminHome />} />
            <Route path="products" element={<Protected roles={ADMIN}><AdminProducts /></Protected>} />
            <Route path="products/new" element={<Protected roles={ADMIN}><ProductForm /></Protected>} />
            <Route path="products/:id/edit" element={<Protected roles={ADMIN}><ProductForm /></Protected>} />
            <Route path="categories" element={<Protected roles={ADMIN}><AdminCategories /></Protected>} />
            <Route path="orders" element={<Protected roles={ADMIN}><AdminOrders /></Protected>} />
            <Route path="orders/:id" element={<Protected roles={ADMIN}><AdminOrderDetail /></Protected>} />
            <Route path="users" element={<Protected roles={ADMIN}><AdminUsers /></Protected>} />
            <Route path="coupons" element={<Protected roles={ADMIN}><AdminCoupons /></Protected>} />
            <Route path="banners" element={<Protected roles={ADMIN}><AdminBanners /></Protected>} />
            <Route path="flash-sales" element={<Protected roles={ADMIN}><AdminFlashSales /></Protected>} />
            <Route path="settings" element={<Protected roles={ADMIN}><AdminSettings /></Protected>} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="reports" element={<Reports />} />
          </Route>

          <Route path="*" element={<p className="py-16 text-center">Page not found. <Link className="text-orange-600 underline" to="/">Go home</Link></p>} />
        </Routes>
      </main>
      {!isAdmin && <Footer />}
      {!isAdmin && <BottomNav />}
    </div>
  );
}
