import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');

app.use(cors());
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
        return res.status(400).send('ID do artista não fornecido. Por favor, comece pelo formulário de informações.');
    }

    console.log(`Dados de Sobre a Obra recebidos para artistId: ${artistId}`, formData);

    const submission = {
        artistId: artistId,
        formType: 'sobre_obra',
        data: formData
    };

    try {
        await saveOrUpdateSubmission(submission);
            res.status(302).set('Location', '/index.html?success=true').end();
    } catch (error) {
        console.error('Erro ao processar formulário da Obra:', error);
        res.status(500).send('Erro ao enviar formulário da obra.');
    }
});


initializeDataFile().then(() => {
    app.listen(PORT, () => {
        console.log(`Servidor rodando em http://localhost:${PORT}`);
    });
});