const pool = require('./db');

async function testar() {
    let conn;

    try {
        conn = await pool.getConnection();

        console.log('✅ Conectado ao MariaDB!');

        await conn.query(
            'INSERT INTO medicoes (nivel, vazao) VALUES (?, ?)',
            [42.5, 8.3]
        );

        console.log('✅ Medição salva no banco!');

    } catch (erro) {
        console.error('❌ Erro:', erro.message);
    } finally {
        if (conn) conn.release();
    }
}

testar();