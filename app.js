require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);

const { pool, query } = require('./config/db');
const { attachUser } = require('./middleware/auth');
const { attachUnreadCount } = require('./middleware/notifications');
const { registerListeners } = require('./events');
const indexRoutes = require('./routes/index');
const apiRoutes = require('./routes/api');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const isProduction = process.env.NODE_ENV === 'production';

if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is missing. Add it to your environment variables.');
}
if (isProduction && process.env.SESSION_SECRET.length < 32) {
  throw new Error('In production SESSION_SECRET must be at least 32 characters long.');
}

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');

if (isProduction) {
  app.set('trust proxy', 1);
}

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000');
  }
  next();
});
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(
  express.static(path.join(__dirname, 'public'), {
    maxAge: isProduction ? '1d' : 0,
  })
);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    store: new pgSession({ pool, tableName: 'session' }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  organizer: 'Organizer',
  student: 'Student',
};

app.use((req, res, next) => {
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  res.locals.currentPath = req.path;

  res.locals.roleLabel = (role) => ROLE_LABELS[role] || role;

  res.locals.formatDate = (value) =>
    value
      ? new Date(value).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : '-';

  res.locals.formatDateInput = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value.slice(0, 10);
    const d = new Date(value);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  res.locals.formatTime = (value) =>
    value
      ? new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : '-';

  next();
});

app.use(attachUser);
app.use(attachUnreadCount);

app.use('/api', apiRoutes); 
app.use('/', indexRoutes); 

app.use(notFound);
app.use(errorHandler);

registerListeners();

if (require.main === module) {
  const server = app.listen(PORT, async () => {
    console.log(`Server running at http://localhost:${PORT} (${process.env.NODE_ENV || 'development'})`);
    try {
      const result = await query('SELECT current_database() AS db');
      console.log(`Database connected: ${result.rows[0].db}`);
    } catch (err) {
      console.error('Database connection failed:', err.message);
    }
  });

  const shutdown = (signal) => {
    console.log(`${signal} received. Shutting down...`);
    server.close(async () => {
      try {
        await pool.end();
      } finally {
        process.exit(0);
      }
    });
    setTimeout(() => process.exit(1), 10000).unref(); // never hang forever
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = app;