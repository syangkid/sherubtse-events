require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);

const { pool, query } = require('./config/db');
const { attachUser } = require('./middleware/auth');
const indexRoutes = require('./routes/index');
const apiRoutes = require('./routes/api');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const { attachUnreadCount } = require('./middleware/notifications');
const { registerListeners } = require('./events');

if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is missing. Add it to your .env file.');
}

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  app.set('trust proxy', 1);
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

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
      ? new Date(value).toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
        })
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

app.listen(PORT, async () => {
  console.log(`Server running at http://localhost:${PORT}`);
  try {
    const result = await query('SELECT current_database() AS db');
    console.log(`Database connected: ${result.rows[0].db}`);
  } catch (err) {
    console.error('Database connection failed:', err.message);
  }
});

module.exports = app;
