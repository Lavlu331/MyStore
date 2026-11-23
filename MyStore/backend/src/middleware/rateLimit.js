const rateLimit = require('express-rate-limit');

const num = (v, fallback) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : fallback; };
const WINDOW = 15 * 60 * 1000; // 15 minutes
const off = () => process.env.RATE_LIMIT_DISABLED === 'true';   // handy for automated tests

const make = (limit, message, extra = {}) => rateLimit({
  windowMs: WINDOW, limit, standardHeaders: 'draft-7', legacyHeaders: false, skip: off,
  message: { message }, ...extra,
});

// Everything under /api
exports.apiLimiter = make(num(process.env.RATE_LIMIT_MAX, 600), 'Too many requests. Please slow down and try again in a few minutes.');

// Guessing passwords: only FAILED logins count
exports.loginLimiter = make(num(process.env.AUTH_RATE_LIMIT_MAX, 20),
  'Too many failed login attempts. Please try again in 15 minutes.', { skipSuccessfulRequests: true });

exports.registerLimiter = make(num(process.env.AUTH_RATE_LIMIT_MAX, 20), 'Too many sign-up attempts. Please try again later.');
exports.passwordLimiter = make(num(process.env.AUTH_RATE_LIMIT_MAX, 20), 'Too many password attempts. Please try again later.');
