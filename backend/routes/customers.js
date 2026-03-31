const express = require('express');
const db      = require('../db');
const router  = express.Router();

// GET all customers
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM customers ORDER BY registration_date DESC');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET customer history
router.get('/:id/history', async (req, res) => {
  try {
    const [customer] = await db.query('SELECT * FROM customers WHERE customer_id = ?', [req.params.id]);
    if (!customer.length) return res.status(404).json({ error: 'Customer not found' });

    const [orders] = await db.query(
      `SELECT o.*, GROUP_CONCAT(CONCAT(oi.quantity,'x ',oi.cloth_type) SEPARATOR ', ') AS items_summary
       FROM orders o
       LEFT JOIN order_items oi ON o.order_id = oi.order_id
       WHERE o.customer_id = ?
       GROUP BY o.order_id
       ORDER BY o.order_date DESC`,
      [req.params.id]
    );

    const [payments] = await db.query(
      `SELECT p.* FROM payments p
       JOIN orders o ON p.order_id = o.order_id
       WHERE o.customer_id = ?
       ORDER BY p.payment_date DESC`,
      [req.params.id]
    );

    res.json({ customer: customer[0], orders, payments });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
