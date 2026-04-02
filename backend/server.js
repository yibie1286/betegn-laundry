const express  = require('express');
const cors     = require('cors');
const path     = require('path');
require('dotenv').config();

const authRoutes     = require('./routes/auth');
const orderRoutes    = require('./routes/orders');
const paymentRoutes  = require('./routes/payments');
const customerRoutes = require('./routes/customers');
const reportRoutes   = require('./routes/reports');

const app = express();

app.set('trust proxy', 1);

app.use(express.static(path.join(__dirname, '../frontend')));

app.use(cors({ origin: true, credentials: true }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple token store (in-memory)
const tokens = new Map();
app.locals.tokens = tokens;

// Auth middleware using Bearer token
function requireAuth(req, res, next) {
  const auth = req.headers['authorization'];
  const token = auth && auth.split(' ')[1];
  if (token && tokens.has(token)) {
    req.user = tokens.get(token);
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
}

app.use('/api', authRoutes);
app.use('/api/orders',    requireAuth, orderRoutes);
app.use('/api/payments',  requireAuth, paymentRoutes);
app.use('/api/customers', requireAuth, customerRoutes);
app.use('/api/reports',   requireAuth, reportRoutes);

// Dashboard analytics
app.get('/api/dashboard', requireAuth, async (req, res) => {
  const db = require('./db');
  try {
    const today = new Date().toISOString().split('T')[0];
    const [[{ total_orders }]]    = await db.query('SELECT COUNT(*) AS total_orders FROM orders');
    const [[{ total_customers }]] = await db.query('SELECT COUNT(*) AS total_customers FROM customers');
    const [[{ pending }]]         = await db.query("SELECT COUNT(*) AS pending FROM orders WHERE status NOT IN ('Delivered')");
    const [[{ delivered }]]       = await db.query("SELECT COUNT(*) AS delivered FROM orders WHERE status = 'Delivered'");
    const [[{ daily_income }]]    = await db.query('SELECT COALESCE(SUM(payment_amount),0) AS daily_income FROM payments WHERE DATE(payment_date) = ?', [today]);
    const [[{ total_income }]]    = await db.query('SELECT COALESCE(SUM(paid_amount),0) AS total_income FROM orders');
    const [[{ total_clothes }]]   = await db.query('SELECT COALESCE(SUM(quantity),0) AS total_clothes FROM order_items');
    const [overdue]               = await db.query("SELECT COUNT(*) AS cnt FROM orders WHERE delivery_date < ? AND status != 'Delivered'", [today]);
    const [unpaid]                = await db.query('SELECT COUNT(*) AS cnt FROM orders WHERE balance > 0');

    res.json({
      total_orders, total_customers, pending, delivered,
      daily_income, total_income, total_clothes,
      overdue: overdue[0].cnt,
      unpaid: unpaid[0].cnt
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Betegn Laundry API running at http://localhost:${PORT}`);
});
