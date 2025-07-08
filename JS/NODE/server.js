import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', '..')));
app.get('/', (req, res) => {
    res.send('Servidor de formulários do museu está rodando!');
});

// Garante que a pasta 'data' existe e inicializa o arquivo JSON
async function initializeDataFile() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        const fileExists = await fs.access(SUBMISSIONS_FILE).then(() => true).catch(() => false);
        if (!fileExists) {
            await fs.writeFile(SUBMISSIONS_FILE, '[]', 'utf8');
            console.log('Arquivo submissions.json criado com sucesso.');
        }
    } catch (error) {
        console.error('Erro ao inicializar o arquivo de dados:', error);
    }
}

// Salva/atualiza os dados em JSON
async function saveOrUpdateSubmission(submissionData) {
    try {
        await initializeDataFile();
        let submissions = [];

        try {
            const fileContent = await fs.readFile(SUBMISSIONS_FILE, 'utf8');
            if (fileContent.trim() !== '') {
                submissions = JSON.parse(fileContent);
            }
        } catch (readError) {
            console.warn(`Aviso: Arquivo ${SUBMISSIONS_FILE} vazio ou corrompido. Iniciando com array vazio.`, readError.message);
            submissions = [];
        }

        const { artistId, formType, data } = submissionData;

        let artistRecord = submissions.find(record => record.artistId === artistId);

        if (artistRecord) {
            artistRecord[formType] = data;
            artistRecord.lastUpdated = new Date().toISOString(); 
        } else {
            artistRecord = {
                artistId: artistId,
                timestampCreated: new Date().toISOString(),
                [formType]: data 
            };
            submissions.push(artistRecord);
        }

        await fs.writeFile(SUBMISSIONS_FILE, JSON.stringify(submissions, null, 2), 'utf8');
        console.log(`Dados (${formType}) salvos/atualizados com sucesso para artistId: ${artistId}`);
    } catch (error) {
        console.error('Erro geral ao salvar/atualizar os dados:', error);
        throw new Error('Falha ao salvar/atualizar os dados do formulário.');
    }
}

app.post('/submit-informacoes', async (req, res) => {
    const formData = req.body;
    console.log('Dados de Informações recebidos:', formData);

    const artistId = uuidv4(); // Gera ID
    const submission = {
        artistId: artistId, 
        formType: 'informacoes',
        data: formData
    };

    try {
        await saveOrUpdateSubmission(submission);
        res.redirect(`/HTML/html_expor_arte/portifolio.html?artistId=${artistId}`);
    } catch (error) {
        console.error('Erro ao processar formulário de Informações:', error);
        res.status(500).send('Erro ao enviar formulário de informações.');
    }
});

app.post('/submit-portifolio', async (req, res) => {
    const artistId = req.query.artistId;
    const formData = req.body;

    if (!artistId) {
        return res.status(400).send('ID do artista não fornecido. Por favor, comece pelo formulário de informações.');
    }

    console.log(`Dados de Portfólio recebidos para artistId: ${artistId}`, formData);

    const submission = {
        artistId: artistId,
        formType: 'portifolio',
        data: formData
    };

    try {
        await saveOrUpdateSubmission(submission);
        res.redirect(`/HTML/html_expor_arte/cadastro_arte.html?artistId=${artistId}`);
    } catch (error) {
        console.error('Erro ao processar formulário de Portfólio:', error);
        res.status(500).send('Erro ao enviar formulário de portfólio.');
    }
});

app.post('/submit-obra', async (req, res) => {
    const artistId = req.query.artistId;
    const formData = req.body;

    if (!artistId) {
        return res.status(400).send('ID do artista não fornecido.');
    }

    try {
        const submission = {
            artistId: artistId,
            formType: 'sobre_obra',
            data: formData
        };

        await saveOrUpdateSubmission(submission);
        
        res.redirect('/index.html?success=true');
        
        // Envia email de forma assíncrona
        sendArtistEmail(artistId)
            .then(success => {
                if (!success) {
                    console.error("Falha ao enviar e-mails para o artista e museu");
                }
            })
            .catch(err => {
                console.error("Erro no processo de envio de e-mail:", err);
            });

    } catch (error) {
        console.error('Erro ao processar formulário:', error);
        res.status(500).send('Erro ao enviar formulário.');
    }
});



// Função para enviar e-mail
async function sendArtistEmail(artistId) {
    console.log("🔍 Iniciando envio de email para artistId:", artistId);
    try {
        const data = await fs.readFile(SUBMISSIONS_FILE, 'utf8');
        const submissions = JSON.parse(data);
        const artistData = submissions.find(a => a.artistId === artistId);

        if (!artistData || !artistData.informacoes || !artistData.informacoes.email) {
            console.error('Dados do artista incompletos ou email não encontrado');
            return false;
        }

        // Verifica a conexão SMTP
        console.log("✔️ Dados do artista encontrados:", artistData.informacoes.nomeCompleto);
        console.log("✔️ Verificando conexão SMTP...");
        await new Promise((resolve, reject) => {
            transporter.verify((error, success) => {
                if (error) {
                    console.error('Erro na conexão SMTP:', error);
                    reject(error);
                } else {
                    console.log('Servidor SMTP pronto');
                    resolve(success);
                }
            });
        });
        console.log("✔️ Conexão SMTP verificada com sucesso");
        // 1. Envia email para o museu
        const museumMail = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_MUSEUM,
            subject: `Nova inscrição: ${artistData.informacoes.nomeCompleto}`,
            html: `<h2>Nova inscrição de artista</h2>
                  <p>Nome: ${artistData.informacoes.nomeCompleto}</p>
                  <p>Email: ${artistData.informacoes.email}</p>
                  <p>Portfólio: ${artistData.portifolio?.portfolioLink || 'Não informado'}</p>`,
            attachments: [{
                filename: `artista_${artistId}.json`,
                content: JSON.stringify(artistData, null, 2),
                contentType: 'application/json'
            }]
        };

        console.log("📤 Enviando e-mail para o museu...");
        await transporter.sendMail(museumMail);
        console.log(`📩 E-mail enviado para o museu (Artista ID: ${artistId})`);

        // Envia email para o artista
        const artistMail = {
            from: process.env.EMAIL_USER,
            to: artistData.informacoes.email,
            subject: 'Recebemos sua inscrição!',
            html: `<p>Olá ${artistData.informacoes.nomeCompleto},</p>
                  <p>Sua inscrição foi recebida com sucesso!</p>
                  <p>Agradecemos pelo seu interesse em participar da nossa exposição.</p>
                  <p>Em breve entraremos em contato com mais informações.</p>`
        };
        console.log("📬 E-mail enviado ao museu com sucesso!");
        await transporter.sendMail(artistMail);
        console.log(`📩 E-mail de confirmação enviado para o artista: ${artistData.informacoes.email}`);
        
        return true;
    } catch (error) {
        console.error('Erro ao enviar e-mail:', error);
        return false;
    }
}

// Teste temporário - remova depois
app.get('/test-email', async (req, res) => {
    try {
        const result = await sendArtistEmail('c4883836-7559-4e4b-9a5b-e5409ab16d72');
        res.send(result ? 'E-mails enviados!' : 'Falha ao enviar e-mails');
    } catch (error) {
        res.status(500).send('Erro: ' + error.message);
    }
});



const server = initializeDataFile().then(() => {
    const server = app.listen(PORT, () => {
        console.log(`Servidor rodando em http://localhost:${PORT}`);
        server.timeout = 10000; // 10 segundos
    });
    return server;
}).catch(err => {
    console.error('Falha ao iniciar servidor:', err);
    process.exit(1);
});