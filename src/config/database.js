const mysql = require('mysql2');

const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'vergyl',
    port: process.env.DB_PORT || '3306',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: '+00:00',
        connectTimeout: 20000 ,// 20 seconds


});
db.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
    } else {
        console.log('✅ Database connected successfully!');
        connection.release(); // release connection back to pool
    }
});

module.exports = db; 