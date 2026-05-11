/**
 * SECURITY MIDDLEWARE
 * ===================
 * Applied globally in server.js for maximum protection:
 *
 *  - Helmet: sets secure HTTP headers (XSS, clickjacking, MIME sniffing etc.)
 *  - Rate limiting: prevents brute force and DDoS
 *  - MongoDB sanitization: prevents NoSQL injection
 *  - HPP: HTTP parameter pollution protection
 *  - CORS: strict origin control
 *  - JWT blacklist: logout invalidation
 *  - Request size limits
 */

const rateLimit = require('express-rate-limit');
const helmet    = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const hpp       = require('hpp');

// ── In-memory JWT blacklist (use Redis in production) ─────────────
const blacklistedTokens = new Set();

const addToBlacklist = (token) => blacklistedTokens.add(token);
const isBlacklisted  = (token) => blacklistedTokens.has(token);

// ── Rate limiters ─────────────────────────────────────────────────

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' }
});

// Strict limiter for auth endpoints (prevents brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 10,                     // Only 10 login attempts per 15 min
  skipSuccessfulRequests: true,
  message: { success: false, message: 'Too many login attempts. Please wait 15 minutes.' }
});

// Booking limiter (prevents queue flooding)
const bookingLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 5,
  message: { success: false, message: 'Too many bookings. Please wait.' }
});

// Upload limiter
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many uploads. Please wait.' }
});

// ── Helmet configuration ──────────────────────────────────────────
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'"],   // Needed for some features
      styleSrc:    ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:     ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:      ["'self'", 'data:', 'blob:'],
      mediaSrc:    ["'self'", 'blob:'],
      connectSrc:  ["'self'", 'ws:', 'wss:'],
    }
  },
  crossOriginEmbedderPolicy: false,   // Allow embedding in iframes (display screen)
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// ── Input sanitization ────────────────────────────────────────────
const sanitize = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`Sanitized suspicious input in ${key}:`, req.ip);
  }
});

// ── HPP ───────────────────────────────────────────────────────────
const hppProtect = hpp({
  whitelist: ['status', 'role', 'doctorId', 'hospitalId']  // Allow arrays for these
});

module.exports = {
  helmetConfig,
  apiLimiter,
  authLimiter,
  bookingLimiter,
  uploadLimiter,
  sanitize,
  hppProtect,
  addToBlacklist,
  isBlacklisted
};
