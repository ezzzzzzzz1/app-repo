// db.js
const mysql = require('mysql2');

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',      // اليوزر بتاعك
    password: '', // الباسورد بتاعك
    database: 'shopify_db'
});

module.exports = pool.promise();