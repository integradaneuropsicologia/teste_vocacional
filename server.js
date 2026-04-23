import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function sanitizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
    .trim();
}

function normalizePayload(payload = {}) {
  return {
    identificacao: payload.identificacao || {},
    respostas: payload.respostas || {},
    escores: payload.escores || {},
    entrevista: payload.entrevista || {},
    resultado_local_texto: payload.resultado_local_texto || null
  };
}

function validatePayload(payload) {
  const normalized = normalizePayload(payload);
  const errors = [];

  if (!normalized.identificacao || typeof normalized.identificacao !== 'object') {
    errors.push('identificacao ausente ou inválida');
  }
  if (!normalized.respostas || typeof normalized.respostas !== 'object') {
    errors.push('respostas ausentes ou inválidas');
  }
  if (!normalized.escores || typeof normalized.escores !== 'object') {
    errors.push('escores ausentes ou inválidos');
  }
  if (!normalized.entrevista || typeof normalized.entrevista !== 'object') {
    errors.push('entrevista ausente ou inválida');
  }

  const respostasCount = Object.keys(normalized.respostas).length;
  const entrevistaCount = Object.keys(normalized.entrevista).length;

  if (respostasCount < 80) {
    errors.push(`foram recebidas apenas ${respostasCount} respostas fechadas`);
  }
  if (entrevistaCount < 12) {
    errors.push(`foram recebidas apenas ${entrevistaCount} respostas abertas`);
  }

  return { normalized, errors };
}

function buildModelInput(payload) {
  const { identificacao, respostas, escores, entrevista, resultado_local_texto } = normalizePayload(payload);

  return [
    'Você receberá dados completos de um formulário autoral de orientação vocacional.',
    'Sua tarefa é interpretar os resultados de maneira técnica, clara e prudente.',
    'Analise apenas o que foi enviado. Não invente traços, história de vida ou diagnósticos.',
    'Cruze: perfis vocacionais, macroáreas, valores de carreira, maturidade da escolha e respostas abertas da entrevista.',
    'Quando houver mistura forte entre perfis, descreva a combinação em vez de forçar uma leitura simplista.',
    'Quando houver maturidade baixa, enfatize exploração realista e coleta de informação profissional.',
    '',
    'IDENTIFICAÇÃO',
    JSON.stringify(identificacao, null, 2),
    '',
    'RESPOSTAS FECHADAS',
    JSON.stringify(respostas, null, 2),
    '',
    'ESCORES LOCAIS',
    JSON.stringify(escores, null, 2),
    '',
    'ENTREVISTA ABERTA',
    JSON.stringify(entrevista, null, 2),
    '',
    'TEXTO LOCAL GERADO NO FRONTEND',
    sanitizeText(resultado_local_texto || 'Não enviado.'),
    '',
    'REGRAS IMPORTANTES',
    '- Não diga que a pessoa nasceu para uma profissão.',
    '- Não trate o resultado como diagnóstico psicológico.',
    '- Não entregue apenas uma profissão: ofereça possibilidades e lógica de combinação.',
    '- Respeite as limitações do material: isso é orientação vocacional, não laudo psicológico.',
    '- Escreva em português do Brasil.'
  ].join('\n');
}

async function gerarAnaliseEstruturada(payload) {
  if (!client) {
    throw new Error('OPENAI_API_KEY não configurada no servidor.');
  }

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-5.4',
    store: false,
    input: [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text: [
              'Você é um assistente especializado em devolutiva de orientação vocacional.',
              'Escreva em português do Brasil.',
              'Seja claro, objetivo, técnico e acolhedor.',
              'Baseie-se exclusivamente nas informações recebidas.',
              'Nunca invente traços, experiências, sintomas ou conclusões que não estejam sustentadas pelos dados.',
              'A saída deve obedecer exatamente ao schema JSON solicitado.'
            ].join(' ')
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: buildModelInput(payload)
          }
        ]
      }
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'relatorio_vocacional',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            resumo_geral: { type: 'string' },
            perfil_predominante: { type: 'string' },
            perfil_secundario: { type: 'string' },
            combinacao_principal: { type: 'string' },
            macroareas_afinidade: {
              type: 'array',
              items: { type: 'string' },
              minItems: 2,
              maxItems: 5
            },
            valores_carreira: {
              type: 'array',
              items: { type: 'string' },
              minItems: 2,
              maxItems: 6
            },
            maturidade_escolha: {
              type: 'object',
              additionalProperties: false,
              properties: {
                nivel: { type: 'string' },
                leitura: { type: 'string' }
              },
              required: ['nivel', 'leitura']
            },
            pontos_fortes: {
              type: 'array',
              items: { type: 'string' },
              minItems: 3,
              maxItems: 6
            },
            pontos_atencao: {
              type: 'array',
              items: { type: 'string' },
              minItems: 2,
              maxItems: 6
            },
            leitura_entrevista_aberta: { type: 'string' },
            ambientes_compativeis: {
              type: 'array',
              items: { type: 'string' },
              minItems: 2,
              maxItems: 6
            },
            areas_profissoes_explorar: {
              type: 'array',
              items: { type: 'string' },
              minItems: 3,
              maxItems: 8
            },
            proximos_passos: {
              type: 'array',
              items: { type: 'string' },
              minItems: 3,
              maxItems: 8
            },
            aviso_final: { type: 'string' }
          },
          required: [
            'resumo_geral',
            'perfil_predominante',
            'perfil_secundario',
            'combinacao_principal',
            'macroareas_afinidade',
            'valores_carreira',
            'maturidade_escolha',
            'pontos_fortes',
            'pontos_atencao',
            'leitura_entrevista_aberta',
            'ambientes_compativeis',
            'areas_profissoes_explorar',
            'proximos_passos',
            'aviso_final'
          ]
        }
      }
    }
  });

  return JSON.parse(response.output_text);
}

function addWrappedText(doc, text, options = {}) {
  doc.font(options.font || 'Helvetica');
  doc.fontSize(options.fontSize || 11);
  doc.fillColor(options.color || '#111827');
  doc.text(sanitizeText(text), {
    width: options.width || 500,
    align: options.align || 'left',
    lineGap: options.lineGap || 3
  });
  doc.moveDown(options.moveDown ?? 0.5);
}

function addList(doc, items = []) {
  items.forEach((item) => {
    doc.font('Helvetica').fontSize(11).fillColor('#111827');
    doc.text(`• ${sanitizeText(item)}`, {
      width: 500,
      lineGap: 3,
      indent: 10
    });
  });
  doc.moveDown(0.6);
}

function drawSectionTitle(doc, title) {
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#0f172a').text(title);
  doc.moveDown(0.35);
}

function gerarPdfBuffer(payload, analise) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: 'Relatório de Orientação Vocacional',
        Author: 'Integração de Orientação Vocacional'
      }
    });

    const buffers = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const nome = sanitizeText(payload?.identificacao?.nome || 'Participante');
    const idade = sanitizeText(payload?.identificacao?.idade || 'Não informada');
    const data = new Date().toLocaleString('pt-BR');

    doc.font('Helvetica-Bold').fontSize(20).fillColor('#0f172a').text('Relatório de Orientação Vocacional');
    doc.moveDown(0.25);
    doc.font('Helvetica').fontSize(11).fillColor('#475569').text(`Participante: ${nome}`);
    doc.text(`Idade: ${idade}`);
    doc.text(`Gerado em: ${data}`);
    doc.moveDown(1);

    drawSectionTitle(doc, '1. Resumo geral');
    addWrappedText(doc, analise.resumo_geral);

    drawSectionTitle(doc, '2. Perfis predominantes');
    addWrappedText(doc, `Perfil predominante: ${analise.perfil_predominante}`);
    addWrappedText(doc, `Perfil secundário: ${analise.perfil_secundario}`);
    addWrappedText(doc, `Combinação principal: ${analise.combinacao_principal}`);

    drawSectionTitle(doc, '3. Macroáreas com maior afinidade');
    addList(doc, analise.macroareas_afinidade);

    drawSectionTitle(doc, '4. Valores de carreira predominantes');
    addList(doc, analise.valores_carreira);

    drawSectionTitle(doc, '5. Maturidade da escolha');
    addWrappedText(doc, `Nível: ${analise.maturidade_escolha.nivel}`);
    addWrappedText(doc, analise.maturidade_escolha.leitura);

    drawSectionTitle(doc, '6. Pontos fortes percebidos');
    addList(doc, analise.pontos_fortes);

    drawSectionTitle(doc, '7. Pontos de atenção');
    addList(doc, analise.pontos_atencao);

    drawSectionTitle(doc, '8. Leitura da entrevista aberta');
    addWrappedText(doc, analise.leitura_entrevista_aberta);

    drawSectionTitle(doc, '9. Ambientes de trabalho compatíveis');
    addList(doc, analise.ambientes_compativeis);

    drawSectionTitle(doc, '10. Áreas e profissões para explorar');
    addList(doc, analise.areas_profissoes_explorar);

    drawSectionTitle(doc, '11. Próximos passos práticos');
    addList(doc, analise.proximos_passos);

    drawSectionTitle(doc, '12. Observação final');
    addWrappedText(doc, analise.aviso_final, { color: '#7c2d12' });

    doc.end();
  });
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, model: process.env.OPENAI_MODEL || 'gpt-5.4' });
});

app.post('/api/analise-vocacional', async (req, res) => {
  try {
    const { normalized, errors } = validatePayload(req.body);
    if (errors.length) {
      return res.status(400).json({ ok: false, error: errors.join('; ') });
    }

    const analise = await gerarAnaliseEstruturada(normalized);
    res.json({ ok: true, analise });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      error: error?.message || 'Falha ao gerar a análise vocacional.'
    });
  }
});

app.post('/api/relatorio-vocacional', async (req, res) => {
  try {
    const { normalized, errors } = validatePayload(req.body);
    if (errors.length) {
      return res.status(400).json({ ok: false, error: errors.join('; ') });
    }

    const analise = await gerarAnaliseEstruturada(normalized);
    const pdfBuffer = await gerarPdfBuffer(normalized, analise);

    const nome = sanitizeText(normalized?.identificacao?.nome || 'participante')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'participante';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="relatorio-vocacional-${nome}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      error: error?.message || 'Falha ao gerar o PDF do relatório vocacional.'
    });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
