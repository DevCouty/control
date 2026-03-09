const express = require('express');
const sql = require('mssql');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Configuração do SQL Server
const config = {
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT),
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

// Pool de conexões
let pool;

// Conectar ao banco
async function conectarBanco() {
    try {
        pool = await sql.connect(config);
        console.log('✅ Conectado ao SQL Server');
    } catch (err) {
        console.error('❌ Erro ao conectar ao SQL Server:', err);
        process.exit(1);
    }
}

// ===========================
// ROTAS DA API
// ===========================

// GET - Listar todas as datas
app.get('/api/datas', async (req, res) => {
    try {
        const result = await pool.request()
            .query('SELECT Id, Tipo, Nome, CONVERT(VARCHAR(10), Data, 23) AS Data FROM dbo.DatasImportantes ORDER BY Data');
        
        res.json(result.recordset);
    } catch (err) {
        console.error('Erro ao listar datas:', err);
        res.status(500).json({ erro: 'Erro ao listar datas' });
    }
});

// GET - Buscar uma data específica
app.get('/api/datas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT Id, Tipo, Nome, CONVERT(VARCHAR(10), Data, 23) AS Data FROM dbo.DatasImportantes WHERE Id = @id');
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ erro: 'Data não encontrada' });
        }
        
        res.json(result.recordset[0]);
    } catch (err) {
        console.error('Erro ao buscar data:', err);
        res.status(500).json({ erro: 'Erro ao buscar data' });
    }
});

// POST - Criar nova data
app.post('/api/datas', async (req, res) => {
    try {
        const { tipo, nome, data } = req.body;
        
        // Validações
        if (!tipo || !nome || !data) {
            return res.status(400).json({ erro: 'Todos os campos são obrigatórios' });
        }
        
        if (!['aniversario', 'casamento'].includes(tipo)) {
            return res.status(400).json({ erro: 'Tipo inválido' });
        }
        
        const result = await pool.request()
            .input('tipo', sql.VarChar(20), tipo)
            .input('nome', sql.NVarChar(200), nome)
            .input('data', sql.Date, data)
            .query(`
                INSERT INTO dbo.DatasImportantes (Tipo, Nome, Data) 
                OUTPUT INSERTED.Id, INSERTED.Tipo, INSERTED.Nome, CONVERT(VARCHAR(10), INSERTED.Data, 23) AS Data
                VALUES (@tipo, @nome, @data)
            `);
        
        res.status(201).json(result.recordset[0]);
    } catch (err) {
        console.error('Erro ao criar data:', err);
        res.status(500).json({ erro: 'Erro ao criar data' });
    }
});

// PUT - Atualizar data
app.put('/api/datas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { tipo, nome, data } = req.body;
        
        // Validações
        if (!tipo || !nome || !data) {
            return res.status(400).json({ erro: 'Todos os campos são obrigatórios' });
        }
        
        if (!['aniversario', 'casamento'].includes(tipo)) {
            return res.status(400).json({ erro: 'Tipo inválido' });
        }
        
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('tipo', sql.VarChar(20), tipo)
            .input('nome', sql.NVarChar(200), nome)
            .input('data', sql.Date, data)
            .query(`
                UPDATE dbo.DatasImportantes 
                SET Tipo = @tipo, Nome = @nome, Data = @data, DataAtualizacao = GETDATE()
                OUTPUT INSERTED.Id, INSERTED.Tipo, INSERTED.Nome, CONVERT(VARCHAR(10), INSERTED.Data, 23) AS Data
                WHERE Id = @id
            `);
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ erro: 'Data não encontrada' });
        }
        
        res.json(result.recordset[0]);
    } catch (err) {
        console.error('Erro ao atualizar data:', err);
        res.status(500).json({ erro: 'Erro ao atualizar data' });
    }
});

// DELETE - Excluir data
app.delete('/api/datas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM dbo.DatasImportantes WHERE Id = @id');
        
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ erro: 'Data não encontrada' });
        }
        
        res.json({ mensagem: 'Data excluída com sucesso' });
    } catch (err) {
        console.error('Erro ao excluir data:', err);
        res.status(500).json({ erro: 'Erro ao excluir data' });
    }
});

// Rota de teste
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', mensagem: 'API funcionando!' });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;

conectarBanco().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Servidor rodando na porta ${PORT}`);
        console.log(`📡 API disponível em http://localhost:${PORT}/api`);
    });
});

// Tratamento de erros não capturados
process.on('unhandledRejection', (err) => {
    console.error('Erro não tratado:', err);
});

process.on('SIGINT', async () => {
    console.log('\n🛑 Encerrando servidor...');
    await pool.close();
    process.exit(0);
});