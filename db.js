const mariadb = require('mariadb');

const pool = mariadb.createPool({
    host: '127.0.0.1',
    port: 3307,
    user: 'root',
    password: process.env.DB_PASSWORD,
    database: 'aquila',
    connectionLimit: 5
});

module.exports = pool;