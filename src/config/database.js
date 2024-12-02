const mysql = require('mysql2');

const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'vergyl',
    port: process.env.DB_PORT || '3306',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = db; 