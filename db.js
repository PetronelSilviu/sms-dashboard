// db.js - helper only if you want modular db access
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
