require('dotenv').config();
const path = require('path');
const { existsSync } = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pool = require('./src/config/db');
const upload = require('./src/middleware/upload');
const { apiLimiter, loginLimiter, registerLimiter, passwordLimiter } = require('./src/middleware/rateLimit');

const isProd = process.env.NODE_ENV === 'production';

// ---- startup checks ----
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  const msg = 'JWT_SECRET must be a random string of at least 32 characters.';
  if (isProd) { console.error(`FATAL: ${msg}`); process.exit(1); }
  console.warn(`WARNING: ${msg} (allowed in development only)`);
}
if (isProd && !process.env.CLIENT_URL) console.warn('WARNING: CLIENT_URL is not set, so CORS is open to every website.');

const app = express();
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1); // behind a reverse proxy / hosting platform

// ---- security headers, CORS, body limits ----
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: { directives: { imgSrc: ["'self'", 'data:', 'https:'] } },
}));
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json({ limit: '100kb' }));

// ---- simple request log (method, path without query string, status, time) ----
if (process.env.NODE_ENV !== 'test') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      if (req.path.startsWith('/uploads')) return;
      console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
  });
}

// Use the same storage directory for serving and writing uploaded images.
app.use('/uploads', express.static(upload.dir, {
  maxAge: '7d',
  setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
}));

// ---- rate limits (must come before the routes) ----
app.use('/api', apiLimiter);
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/auth/password', passwordLimiter);
app.use('/api/account/deactivate', passwordLimiter);

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

app.use('/api/auth', require('./src/routes/auth.routes'));
app.use('/api/categories', require('./src/routes/category.routes'));
app.use('/api/products', require('./src/routes/product.routes'));
app.use('/api/cart', require('./src/routes/cart.routes'));
app.use('/api/wishlist', require('./src/routes/wishlist.routes'));
app.use('/api/reviews', require('./src/routes/review.routes'));
app.use('/api/orders', require('./src/routes/order.routes'));
app.use('/api/inventory', require('./src/routes/inventory.routes'));
app.use('/api/notifications', require('./src/routes/notification.routes'));
app.use('/api/reports', require('./src/routes/report.routes'));
app.use('/api/users', require('./src/routes/user.routes'));
app.use('/api/coupons', require('./src/routes/coupon.routes'));
app.use('/api/settings', require('./src/routes/settings.routes'));
app.use('/api/banners', require('./src/routes/banner.routes'));
app.use('/api/flash-sales', require('./src/routes/flash.routes'));
app.use('/api/addresses', require('./src/routes/address.routes'));
app.use('/api/account', require('./src/routes/account.routes'));
app.use('/api/uploads', require('./src/routes/upload.routes'));

const notFound = (req, res) => res.status(404).json({ message: 'Route not found' });
app.use(['/api', '/uploads'], notFound);

// In a combined production deployment, serve the built storefront and its client-side routes.
const storefrontDir = path.resolve(__dirname, '../frontend/dist');
const storefrontIndex = path.join(storefrontDir, 'index.html');
if (isProd && existsSync(storefrontIndex)) {
  app.use(express.static(storefrontDir));
  app.get('*', (req, res, next) => {
    if (path.extname(req.path) || !req.accepts('html')) return next();
    res.sendFile(storefrontIndex);
  });
}

app.use(notFound);

// ---- one place for errors; internal details are shown only outside production ----
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'The request body is not valid JSON' });
  if (err.type === 'entity.too.large') return res.status(413).json({ message: 'The request is too large' });
  console.error(err);
  res.status(500).json({
    message: 'Internal server error',
    ...(!isProd && { detail: err.sqlMessage || err.message }),
  });
});

process.on('unhandledRejection', (reason) => console.error('Unhandled promise rejection:', reason));

const PORT = Number(process.env.PORT || 5000);
const HOST = process.env.IP || process.env.HOST || undefined;
if (require.main === module) {
  app.listen(PORT, HOST, () => console.log(`Server running on port ${PORT}${isProd ? ' (production)' : ''}`));
}
module.exports = app;
