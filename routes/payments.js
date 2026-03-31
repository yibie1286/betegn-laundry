const express = require('express');
const db      = require('../db');
const router  = express.Router();

// GET all payments with order info
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT p.*, o.total_amount, o.paid_amount, o.balance, o.status,
             c.customer_name, c.phone
      FROM payments p
      JOIN orders o ON p.order_id = o.order_id
      JOIN customers c ON o.customer_id = c.customer_id
      ORDER BY p.payment_date DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST add payment
router.post('/', async (req, res) => {
  const { order_id, payment_amount, payment_method } = req.body;
  if (!order_id || !payment_amount)
    return res.status(400).json({ error: 'order_id and payment_amount required' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [orders] = await conn.query('SELECT * FROM orders WHERE order_id = ?', [order_id]);
    if (!orders.length) { await conn.rollback(); return res.status(404).json({ error: 'Order not found' }); }

    const order = orders[0];
    const amount = parseFloat(payment_amount);
    const newPaid = parseFloat(order.paid_amount) + amount;
    const newBalance = parseFloat(order.total_amount) - newPaid;

    if (newBalance < -0.01) {
      await conn.rollback();
      return res.status(400).json({ error: `Payment exceeds balance. Max allowed: ${order.balance} ETB` });
    }

    await conn.query(
      'INSERT INTO payments (order_id, payment_amount, payment_method) VALUES (?, ?, ?)',
      [order_id, amount, payment_method || 'Cash']
    );

    await conn.query(
      'UPDATE orders SET paid_amount = ?, balance = ? WHERE order_id = ?',
      [newPaid, Math.max(0, newBalance), order_id]
    );

    await conn.query(
      'UPDATE customers SET total_paid = total_paid + ? WHERE customer_id = ?',
      [amount, order.customer_id]
    );

    await conn.commit();
    res.json({ success: true, new_paid: newPaid, new_balance: Math.max(0, newBalance) });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
