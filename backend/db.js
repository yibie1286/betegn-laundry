const mysql  = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:             process.env.DB_HOST || 'localhost',
  user:             process.env.DB_USER || 'root',
  password:         process.env.DB_PASS || '',
  database:         process.env.DB_NAME || 'betegn_laundry',
  port:             process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit:  10,
  queueLimit:       0,
  // SSL only when DB_SSL=true (e.g. Aiven). Local MySQL uses no SSL.
  ...(process.env.DB_SSL === 'true' && { ssl: { rejectUnauthorized: false } })
});

module.exports = pool;
