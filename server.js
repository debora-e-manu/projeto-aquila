const express = require('express');
const path = require('path');
const pool = require('./db');

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

    const { nivel1, nivel2, vazao, bomba } = req.body;

    const estadoBomba = bomba === 'ligada' ? 'ligada' : 'desligada';

    try {

        await pool.query(
            `INSERT INTO medicoes (nivel1, nivel2, vazao, bomba)
             VALUES ($1, $2, $3, $4)`,
            [nivel1, nivel2, vazao, estadoBomba]
        );

        res.json({
            mensagem: 'Medição salva com sucesso!',
            bomba: estadoBomba
        });

    } catch (erro) {

        console.error('Erro ao salvar medição:', erro);

        res.status(500).json({
            erro: 'Erro ao salvar medição'
        });

    }
});

 // ========================================
 // STATUS ATUAL
 // ========================================

app.get('/api/status', async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT nivel1, nivel2, vazao, bomba, data_hora
             FROM medicoes
             ORDER BY id DESC
             LIMIT 1`
        );

        if (resultado.rows.length === 0) {
            return res.json({
                nivel1: 0,
                nivel2: 0,
                vazao: 0,
                sensor: 'sem dados',
                timestamp: null
            });
        }

        const ultima = resultado.rows[0];

        // Considera ativo somente se a última medição
        // tiver sido recebida nos últimos 30 segundos.
        const agora = Date.now();
        const horarioMedicao = new Date(ultima.data_hora).getTime();
        const idadeMedicao = agora - horarioMedicao;

        const sensorAtivo =
            Number.isFinite(horarioMedicao) &&
            idadeMedicao >= 0 &&
            idadeMedicao <= 30000;

        return res.json({
            nivel1: Number(ultima.nivel1),
            nivel2: Number(ultima.nivel2),
            vazao: Number(ultima.vazao),
            bomba: ultima.bomba,
            sensor: sensorAtivo ? 'ativo' : 'inativo',
            timestamp: ultima.data_hora
        });

    } catch (erro) {
        console.error('Erro ao buscar status:', erro);

        return res.status(500).json({
            erro: 'Erro ao buscar status'
        });
    }
});


// ========================================
// HISTÓRICO
// ========================================

app.get('/api/historico', async (req, res) => {

    try {

        const resultado = await pool.query(
            `SELECT nivel1, nivel2, vazao, data_hora
             FROM medicoes
             ORDER BY id ASC`
        );

        const historico = resultado.rows.map(item => {

            const nivel = (Number(item.nivel2) / 84) * 100;

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

const PORT = process.env.PORT || 3000;

async function iniciarServidor() {
    try {
        await pool.query(`
            ALTER TABLE medicoes
            ADD COLUMN IF NOT EXISTS bomba VARCHAR(10) DEFAULT 'desligada'
        `);

        console.log('✅ Coluna bomba verificada no banco!');

    } catch (erro) {
        console.error('❌ Erro ao preparar a coluna bomba:', erro);
    }

    app.listen(PORT, '0.0.0.0', () => {
        console.log('====================================');
        console.log('🚀 ÁQUILA ONLINE');
        console.log(`🌐 Porta: ${PORT}`);
        console.log('====================================');
    });
}

iniciarServidor();

