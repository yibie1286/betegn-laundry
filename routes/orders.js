const express = require('express');
const db      = require('../db');
const router  = express.Router();

// Generate order ID
function genOrderId() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `BL-${ymd}-${rand}`;
}

// GET all orders
router.get('/', async (req, res) => {
  try {
    const [orders] = await db.query(`
      SELECT o.*, c.customer_name, c.phone,
        (SELECT COUNT(*) FROM order_items WHERE order_id = o.order_id) AS item_count
      FROM orders o
      JOIN customers c ON o.customer_id = c.customer_id
      ORDER BY o.created_at DESC
    `);
    res.json(orders);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET single order with items
router.get('/:id', async (req, res) => {
  try {
    const [orders] = await db.query(
      'SELECT o.*, c.customer_name, c.phone, c.address FROM orders o JOIN customers c ON o.customer_id = c.customer_id WHERE o.order_id = ?',
      [req.params.id]
    );
    if (!orders.length) return res.status(404).json({ error: 'Order not found' });

    const [items] = await db.query('SELECT * FROM order_items WHERE order_id = ?', [req.params.id]);
    const [payments] = await db.query('SELECT * FROM payments WHERE order_id = ? ORDER BY payment_date DESC', [req.params.id]);

    res.json({ ...orders[0], items, payments });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create order
router.post('/', async (req, res) => {
  const { customer_name, phone, address, order_date, delivery_date, items, paid_amount, notes, discount_percent } = req.body;

  if (!customer_name || !phone || !items || !items.length)
    return res.status(400).json({ error: 'Missing required fields' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Upsert customer
    let [existing] = await conn.query('SELECT customer_id FROM customers WHERE phone = ?', [phone]);
    let customer_id;
    if (existing.length) {
      customer_id = existing[0].customer_id;
      await conn.query('UPDATE customers SET customer_name = ?, address = ? WHERE customer_id = ?', [customer_name, address || '', customer_id]);
    } else {
      const [result] = await conn.query(
        'INSERT INTO customers (customer_name, phone, address) VALUES (?, ?, ?)',
        [customer_name, phone, address || '']
      );
      customer_id = result.insertId;
    }

    const order_id = genOrderId();
    const subtotal = items.reduce((s, i) => s + (i.quantity * i.unit_price), 0);
    const disc_pct = parseFloat(discount_percent) || 0;
    const disc_amt = subtotal * disc_pct / 100;
    const total_amount = subtotal - disc_amt;
    const paid = parseFloat(paid_amount) || 0;
    const balance = total_amount - paid;

    await conn.query(
      `INSERT INTO orders (order_id, customer_id, order_date, delivery_date, subtotal, discount_percent, discount_amount, total_amount, paid_amount, balance, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [order_id, customer_id, order_date || new Date().toISOString().split('T')[0], delivery_date || null, subtotal, disc_pct, disc_amt, total_amount, paid, balance, notes || '']
    );

    for (const item of items) {
      const line_total = item.quantity * item.unit_price;
      await conn.query(
        'INSERT INTO order_items (order_id, cloth_type, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)',
        [order_id, item.cloth_type, item.quantity, item.unit_price, line_total]
      );
    }

    if (paid > 0) {
      await conn.query(
        'INSERT INTO payments (order_id, payment_amount, payment_method) VALUES (?, ?, ?)',
        [order_id, paid, req.body.payment_method || 'Cash']
      );
    }

    // Update customer totals
    await conn.query(
      'UPDATE customers SET total_orders = total_orders + 1, total_paid = total_paid + ? WHERE customer_id = ?',
      [paid, customer_id]
    );

    await conn.commit();
    res.json({ success: true, order_id });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// PUT update order
router.put('/:id', async (req, res) => {
  const { delivery_date, notes, discount_percent } = req.body;
  try {
    await db.query(
      'UPDATE orders SET delivery_date = ?, notes = ?, discount_percent = ? WHERE order_id = ?',
      [delivery_date, notes, discount_percent || 0, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH update status
router.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  const valid = ['Received','Washing','Ironing','Ready','Delivered'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  try {
    await db.query('UPDATE orders SET status = ? WHERE order_id = ?', [status, req.params.id]);
    res.json({ success: true, status });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE order
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM orders WHERE order_id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Search orders
router.get('/search/:query', async (req, res) => {
  const q = `%${req.params.query}%`;
  try {
    const [rows] = await db.query(
      `SELECT o.*, c.customer_name, c.phone FROM orders o
       JOIN customers c ON o.customer_id = c.customer_id
       WHERE c.customer_name LIKE ? OR c.phone LIKE ? OR o.order_id LIKE ?
       ORDER BY o.created_at DESC`,
      [q, q, q]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
