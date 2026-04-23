# Orientação vocacional integrada

## O que este pacote faz
- serve o formulário em `http://localhost:3000`
- calcula os escores no navegador
- envia o payload completo ao backend
- chama a Responses API da OpenAI com saída estruturada
- gera e devolve um PDF interpretativo

## Estrutura
- `public/index.html` → frontend completo em HTML, CSS e JavaScript
- `server.js` → backend Node/Express
- `.env.example` → variáveis de ambiente
- `package.json` → dependências

## Como rodar
```bash
npm install
cp .env.example .env
npm run dev
```

## Variáveis de ambiente
```env
OPENAI_API_KEY=sua_chave_aqui
OPENAI_MODEL=gpt-5.4
PORT=3000
```

## Rotas
- `GET /api/health`
- `POST /api/analise-vocacional`
- `POST /api/relatorio-vocacional`

## Fluxo
1. preencher o formulário
2. clicar em `Calcular resultados`
3. clicar em `Gerar análise no servidor` para receber a leitura estruturada
4. clicar em `Baixar PDF do servidor` para gerar o PDF final

## Observações
- se o frontend estiver sendo servido pelo mesmo Node, deixe o campo `URL do backend` em branco
- se o frontend estiver hospedado separado, preencha o campo com a URL do servidor
- o backend faz uma validação básica e exige as respostas fechadas e abertas
