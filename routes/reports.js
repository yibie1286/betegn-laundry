const express = require('express');
const db      = require('../db');
const router  = express.Router();

// GET monthly report
router.get('/monthly', async (req, res) => {
  const { year, month } = req.query;
  const y = year  || new Date().getFullYear();
  const m = month || new Date().getMonth() + 1;

  try {
    const [[summary]] = await db.query(
      `SELECT COUNT(*) AS total_orders,
              COALESCE(SUM(total_amount),0) AS total_revenue,
              COALESCE(SUM(paid_amount),0)  AS total_collected,
              COALESCE(SUM(balance),0)      AS total_outstanding,
              SUM(status='Delivered')       AS delivered,
              SUM(status!='Delivered')      AS pending
       FROM orders
       WHERE YEAR(order_date) = ? AND MONTH(order_date) = ?`,
      [y, m]
    );

    const [daily] = await db.query(
      `SELECT DAY(order_date) AS day,
              COUNT(*) AS orders,
              COALESCE(SUM(total_amount),0) AS revenue
       FROM orders
       WHERE YEAR(order_date) = ? AND MONTH(order_date) = ?
       GROUP BY DAY(order_date)
       ORDER BY day`,
      [y, m]
    );

    const [top_customers] = await db.query(
      `SELECT c.customer_name, c.phone, COUNT(o.order_id) AS orders,
              COALESCE(SUM(o.total_amount),0) AS total_spent
       FROM customers c
       JOIN orders o ON c.customer_id = o.customer_id
       WHERE YEAR(o.order_date) = ? AND MONTH(o.order_date) = ?
       GROUP BY c.customer_id
       ORDER BY total_spent DESC
       LIMIT 5`,
      [y, m]
    );

    const [items_breakdown] = await db.query(
      `SELECT oi.cloth_type, SUM(oi.quantity) AS total_qty,
              COALESCE(SUM(oi.line_total),0) AS total_revenue
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.order_id
       WHERE YEAR(o.order_date) = ? AND MONTH(o.order_date) = ?
       GROUP BY oi.cloth_type
       ORDER BY total_qty DESC`,
      [y, m]
    );

    res.json({ summary, daily, top_customers, items_breakdown, year: y, month: m });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET daily report
router.get('/daily', async (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  try {
    const [orders] = await db.query(
      `SELECT o.*, c.customer_name, c.phone FROM orders o
       JOIN customers c ON o.customer_id = c.customer_id
       WHERE o.order_date = ?`,
      [date]
    );
    const [[totals]] = await db.query(
      `SELECT COALESCE(SUM(total_amount),0) AS revenue,
              COALESCE(SUM(paid_amount),0) AS collected,
              COUNT(*) AS orders
       FROM orders WHERE order_date = ?`,
      [date]
    );
    res.json({ date, orders, totals });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
