// testEmail.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// Configuração de caminhos (igual ao server.js)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');

// Função para carregar os dados (similar ao server.js)
async function loadSubmissions() {
    try {
        await fs.access(SUBMISSIONS_FILE);
        const data = await fs.readFile(SUBMISSIONS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Erro ao carregar dados:', error.message);
        return [];
    }
}

// Função principal de teste
async function testEmailSystem() {
    // 1. Configuração do transporter (igual ao server.js)
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        },
        tls: {
            rejectUnauthorized: false
        }
    });

    // 2. Carrega os dados existentes
    const submissions = await loadSubmissions();
    
    if (submissions.length === 0) {
        console.log('ℹ️ Nenhum artista cadastrado para teste');
        return;
    }

    // 3. Pega o último artista cadastrado
    const testArtist = submissions[submissions.length - 1];
    console.log('🔄 Testando com artista:', testArtist.artistId);

    // 4. Prepara o e-mail de teste
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_MUSEUM,
        subject: `[TESTE] Dados do artista ${testArtist.informacoes?.nomeCompleto || testArtist.artistId}`,
        html: `
            <h2>Este é um e-mail de TESTE</h2>
            <p>ID do artista: <strong>${testArtist.artistId}</strong></p>
            <p>Verifique o anexo JSON com todos os dados.</p>
        `,
        attachments: [{
            filename: `teste_artista_${testArtist.artistId}.json`,
            content: JSON.stringify(testArtist, null, 2),
            contentType: 'application/json'
        }]
    };

    // 5. Envia o e-mail
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ E-mail de teste enviado com sucesso!');
        console.log('📧 Detalhes:', info.response);
    } catch (error) {
        console.error('❌ Falha no envio do e-mail:', error.message);
    }
}

// Executa o teste
testEmailSystem().catch(console.error);