const mariadb = require('mariadb');

const pool = mariadb.createPool({
    uri: process.env.DATABASE_URL,
    connectionLimit: 5
});

module.exports = pool;