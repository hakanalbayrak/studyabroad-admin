require('dotenv').config();
const mysql = require('mysql2/promise');

const poolConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  connectTimeout: 10000
};

// Use Unix socket if DB_SOCKET is set (fixes cPanel @'127.0.0.1' vs @'localhost' grant issue)
if (process.env.DB_SOCKET) {
  poolConfig.socketPath = process.env.DB_SOCKET;
} else {
  poolConfig.host = process.env.DB_HOST || 'localhost';
  poolConfig.port = parseInt(process.env.DB_PORT) || 3306;
}

const pool = mysql.createPool(poolConfig);

module.exports = pool;
