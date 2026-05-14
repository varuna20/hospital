/**
 * HOSPITAL ECHANNELING SYSTEM v3
 * Security: Helmet, Rate limiting, NoSQL sanitization
 * Features: Prescriptions, Video, Backup, Subscriptions, SMS, Email
 */
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const http = require('http');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

const app    = express();
app.set('trust proxy', 1); // Required for Render/Vercel rate limiting
const server = http.createServer(app);

// ── Security ─────────────────────────────────────────────────────
let helmet, mongoSanitize, hpp, rateLimit, compression;
try {
  helmet         = require('helmet');
  mongoSanitize  = require('express-mongo-sanitize');
  hpp            = require('hpp');
  rateLimit      = require('express-rate-limit');
  compression    = require('compression');
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "img-src": ["*", "data:", "blob:"],
        "media-src": ["*", "data:", "blob:"],
        "connect-src": ["'self'", "*"],
      },
    },
  }));
  app.use(mongoSanitize({ replaceWith: '_' }));
  app.use(hpp({ whitelist: ['status','role','doctorId','hospitalId'] }));
  app.use(compression());
  // Rate limiting
  // General API: 1000 requests per 15 min (generous for busy clinic staff)
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: { success: false, message: 'Too many requests, please slow down' },
    skip: (req) => {
      // Skip rate limiting for authenticated staff/admin/doctor — only throttle anonymous
      return !!req.headers.authorization;
    }
  });

  // Auth: strict — 20 attempts per 15 min (prevents brute force)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    skipSuccessfulRequests: true,
    message: { success: false, message: 'Too many login attempts, try again in 15 minutes' }
  });

  // Booking: 200 per minute for staff bulk-booking sessions (was 10 — way too low)
  const bookingLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    message: { success: false, message: 'Too many bookings per minute' }
  });

  app.use('/api/', apiLimiter);
  app.use('/api/auth/login', authLimiter);
  app.use('/api/appointments/book', bookingLimiter);
  console.log('🔒 Security middleware loaded');
} catch(e) {
  console.warn('⚠️  Security packages not installed yet — run npm install');
}

// ── CORS ─────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

// ── Static files ──────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Security response headers ─────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// ── Routes ────────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/superadmin',    require('./routes/superadmin'));
app.use('/api/hospitals',     require('./routes/hospitals'));
app.use('/api/doctors',       require('./routes/doctors'));
app.use('/api/patients',      require('./routes/patients'));
app.use('/api/appointments',  require('./routes/appointments'));
app.use('/api/queue',         require('./routes/queue'));
app.use('/api/staff',         require('./routes/staff'));
app.use('/api/revenue',       require('./routes/revenue'));
app.use('/api/whatsapp',      require('./routes/whatsapp'));
app.use('/api/prescriptions', require('./routes/prescriptions'));
app.use('/api/display',       require('./routes/displayRoute'));
app.use('/api/system',        require('./routes/system'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/drugs',         require('./routes/drugs'));

// Backup routes
app.use('/api/backup', require('./routes/backup'));

app.get('/api/health', (_, res) => res.json({ status: 'ok', version: '3.0', timestamp: new Date() }));

// ── Socket.IO ─────────────────────────────────────────────────────
const setupSocket = require('./socket');
const io = setupSocket(server);
app.set('io', io);

// ── Error handler ─────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', req.method, req.url, err.message);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
});
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// ── Database ──────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ MongoDB connected');
    try {
      await require('./utils/initDefaults')();
      require('./utils/backup').startBackupScheduler();
      require('./utils/billing').startBillingScheduler();
      require('./utils/reminders').startReminderScheduler();
    } catch(e) { console.warn('Init:', e.message); }
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => console.log('🚀 Server on port', PORT));
  })
  .catch(err => { console.error('❌ DB error:', err.message); process.exit(1); });

process.on('SIGTERM', () => { server.close(() => { mongoose.connection.close(); process.exit(0); }); });
module.exports = { app, server };
