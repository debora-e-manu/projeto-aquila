const express = require('express');
const path = require('path');
const pool = require('./db');

console.log("MYSQLHOST:", process.env.MYSQLHOST);
console.log("MYSQLPORT:", process.env.MYSQLPORT);
console.log("MYSQLUSER:", process.env.MYSQLUSER);
console.log("MYSQLDATABASE:", process.env.MYSQLDATABASE);
console.log("MYSQLPASSWORD existe:", !!process.env.MYSQLPASSWORD);

const app = express();

app.use(express.json());

// ========================================
// SERVIR O SITE DO ÁQUILA
// ========================================

app.use(express.static(__dirname));


// ========================================
// ROTA PRINCIPAL
// ========================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


// ========================================
// SALVAR MEDIÇÃO DO ESP32
// ========================================

app.post('/api/medicoes', async (req, res) => {

    const { nivel1, nivel2, vazao } = req.body;

    let conn;

    try {

        conn = await pool.getConnection();

        await conn.query(
            `INSERT INTO medicoes (nivel1, nivel2, vazao)
             VALUES (?, ?, ?)`,
            [nivel1, nivel2, vazao]
        );

        res.json({
            mensagem: 'Medição salva com sucesso!'
        });

    } catch (erro) {

        console.error('Erro ao salvar medição:', erro);

        res.status(500).json({
            erro: 'Erro ao salvar medição'
        });

    } finally {

        if (conn) {
            conn.release();
        }

    }
});


// ========================================
// BUSCAR MEDIÇÕES
// ========================================

app.get('/api/medicoes', async (req, res) => {

    let conn;

    try {

        conn = await pool.getConnection();

        const medicoes = await conn.query(
            `SELECT id, nivel1, nivel2, vazao, data_hora
             FROM medicoes
             ORDER BY id DESC`
        );

        res.json(medicoes);

    } catch (erro) {

        console.error('Erro ao buscar medições:', erro);

        res.status(500).json({
            erro: 'Erro ao buscar medições'
        });

    } finally {

        if (conn) {
            conn.release();
        }

    }
});


// ========================================
// STATUS ATUAL
// ========================================

app.get('/api/status', async (req, res) => {

    let conn;

    try {

        conn = await pool.getConnection();

        const resultado = await conn.query(
            `SELECT nivel1, nivel2, vazao, data_hora
             FROM medicoes
             ORDER BY id DESC
             LIMIT 1`
        );

        if (resultado.length === 0) {

            return res.json({
                nivel: 0,
                volume: 0,
                vazao: 0,
                bomba: false,
                sensor: 'sem dados',
                timestamp: null
            });

        }

        const ultima = resultado[0];

        // Usaremos o reservatório 2 como nível principal
        // até adaptarmos o dashboard para mostrar os dois.
        const nivelPercentual =
            (Number(ultima.nivel2) / 84) * 100;

        res.json({
            nivel1: Number(ultima.nivel1),
            nivel2: Number(ultima.nivel2),
            vazao: Number(ultima.vazao),
            sensor: 'ativo',
            timestamp: ultima.data_hora
        });

    } catch (erro) {

        console.error('Erro ao buscar status:', erro);

        res.status(500).json({
            erro: 'Erro ao buscar status'
        });

    } finally {

        if (conn) {
            conn.release();
        }

    }
});


// ========================================
// HISTÓRICO
// ========================================

app.get('/api/historico', async (req, res) => {

    let conn;

    try {

        conn = await pool.getConnection();

        const resultado = await conn.query(
            `SELECT nivel1, nivel2, vazao, data_hora
             FROM medicoes
             ORDER BY id ASC`
        );

        const historico = resultado.map(item => {

            const nivel =
                (Number(item.nivel2) / 84) * 100;

            return {
                timestamp: item.data_hora,
                nivel: Math.max(0, Math.min(100, nivel)),
                volume: Number(item.nivel2),
                vazao: Number(item.vazao),
                sensor: 'ativo'
            };

        });

        res.json(historico);

    } catch (erro) {

        console.error('Erro ao buscar histórico:', erro);

        res.status(500).json({
            erro: 'Erro ao buscar histórico'
        });

    } finally {

        if (conn) {
            conn.release();
        }

    }
});


// ========================================
// ALERTAS
// ========================================

app.get('/api/alertas', (req, res) => {

    res.json([]);

});


// ========================================
// CONFIGURAÇÕES
// ========================================

app.get('/api/configuracoes', (req, res) => {

    res.json({
        capacidade: 84,
        altura: 0.84,
        minimo: 20,
        maximo: 90,
        calibracao: 1
    });

});


app.post('/api/configuracoes', (req, res) => {

    res.json(req.body);

});


// ========================================
// SAÚDE DA API
// ========================================

app.get('/api/health', (req, res) => {

    res.json({
        status: 'online',
        service: 'Aquila API'
    });

});


// ========================================
// INICIAR SERVIDOR
// ========================================

app.listen(3000, () => {

    console.log('====================================');
    console.log('🚀 ÁQUILA ONLINE');
    console.log('🌐 http://localhost:3000');
    console.log('====================================');

});