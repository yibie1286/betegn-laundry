const express = require('express');
const bcrypt  = require('bcrypt');
const crypto  = require('crypto');
const db      = require('../db');
const router  = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required' });

  try {
    const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = crypto.randomBytes(32).toString('hex');
    const userData = { id: user.user_id, username: user.username, role: user.role };
    req.app.locals.tokens.set(token, userData);

    res.json({ success: true, token, user: userData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/logout', (req, res) => {
  const auth = req.headers['authorization'];
  const token = auth && auth.split(' ')[1];
  if (token) req.app.locals.tokens.delete(token);
  res.json({ success: true });
});

router.get('/me', (req, res) => {
  const auth = req.headers['authorization'];
  const token = auth && auth.split(' ')[1];
  if (token && req.app.locals.tokens.has(token)) {
    res.json(req.app.locals.tokens.get(token));
  } else {
    res.status(401).json({ error: 'Not logged in' });
  }
});

module.exports = router;
