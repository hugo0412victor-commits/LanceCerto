# AutoArremate Gestao

ERP/CRM web para compra, preparacao e revenda de veiculos arrematados em leilao.

O foco do projeto e tratar cada lote como um projeto individual com:

- dados do lote e snapshot interno;
- fotos e documentos;
- custos previstos e realizados;
- controle operacional por etapas;
- simulacao de arremate;
- pesquisa de mercado;
- precificacao;
- venda e ROI;
- score de oportunidade;
- analise assistida por IA;
- relatorios e exportacoes.

## Regra principal

O sistema foi projetado para **nunca interromper o fluxo por falta de informacao**.

Se faltarem dados de lote, mercado, FIPE, documento ou foto, o comportamento esperado e:

1. salvar o que estiver disponivel;
2. marcar o restante como pendente;
3. permitir edicao posterior;
4. manter o snapshot e o historico.

Essa regra esta registrada em [REQUISITOS.md](C:/Users/carlo/Documents/Codex/2026-04-30/regra-principal-este-sistema-deve-ser/REQUISITOS.md).

## Stack adotada

- Front-end: Next.js App Router + React + TypeScript
- Back-end: Route Handlers + Server Actions
- Banco: PostgreSQL
- ORM: Prisma
- Auth: NextAuth com Credentials Provider
- UI: Tailwind CSS + componentes utilitarios inspirados em shadcn/ui
- Graficos: Recharts
- Formularios: server actions e componentes React
- Upload: rota interna com storage local em desenvolvimento
- Exportacao: CSV, XLSX e PDF

## O que foi implementado

### Fase 1

- login com perfis e controle basico por permissao
- layout profissional com sidebar e shell autenticado
- dashboard principal com cards e graficos
- cadastro de lotes/veiculos manual
- importacao por link com `LotImporter`
- snapshot do lote salvo internamente
- upload de documentos
- upload de fotos
- controle de gastos por veiculo
- simulador de arremate
- controle de processos com visao kanban
- registro de venda
- seed demo com 5 veiculos, 3 leiloeiras e 6 fornecedores

### Fase 2

- modulo de pesquisa de mercado
- registro manual assistido quando a busca automatica nao estiver disponivel
- comparativo FIPE x mercado
- score de oportunidade com pesos
- fornecedores
- relatorios gerenciais
- exportacao em CSV/XLSX/PDF

### Fase 3

- motor de sugestao de lance maximo
- IA mockada para risco do lote
- IA mockada para copy de anuncio
- ranking de leiloeiras
- ranking de fornecedores
- estrutura para WhatsApp assistido
- estrutura para portais de venda
- interfaces de integracao para mercado e anuncios

### Fase Financeiro

- livro razao central em `FinancialEntry`
- categorias, subcategorias, contas financeiras e parceiros financeiros
- contas a pagar e contas a receber derivadas dos lancamentos
- resumo financeiro por veiculo em `VehicleFinancialSummary`
- cada veiculo tratado como centro de custo e resultado
- sincronizacao idempotente dos dados antigos de `Expense`, `Sale`, `CashFlow` e campos financeiros de `Vehicle`
- preservacao das tabelas antigas para compatibilidade
- `CashFlow` legado/anomalo preservado e marcado fora dos calculos principais ate validacao

## Estrutura principal

```text
app/
  (app)/
    dashboard/
    vehicles/
    simulator/
    market-research/
    expenses/
    processes/
    documents/
    photos/
    suppliers/
    sales/
    reports/
    settings/
  api/
    auth/
    lots/import/
    uploads/
    exports/
components/
  auth/
  common/
  dashboard/
  layout/
  processes/
  uploads/
  ui/
  vehicles/
lib/
  ai.ts
  audit.ts
  auth.ts
  calculations.ts
  data.ts
  lot-importer/
  market-price-provider.ts
  rankings.ts
  storage.ts
  whatsapp.ts
prisma/
  schema.prisma
  seed.ts
public/placeholders/
```

## Models principais

O schema Prisma contempla os models pedidos no briefing:

- `User`
- `Role`
- `Vehicle`
- `LotSnapshot`
- `AuctionHouse`
- `VehiclePhoto`
- `VehicleDocument`
- `Expense`
- `ExpenseCategory`
- `ProcessStep`
- `VehicleProcess`
- `Simulation`
- `MarketResearch`
- `MarketSource`
- `MarketListing`
- `Sale`
- `Supplier`
- `Advertisement`
- `Lead`
- `CashFlow`
- `FinancialEntry`
- `FinancialCategory`
- `FinancialSubcategory`
- `FinancialAccount`
- `FinancialPartner`
- `Payable`
- `Receivable`
- `VehicleFinancialSummary`
- `PartnerCommission`
- `AuditLog`
- `Setting`
- `OpportunityScore`
- `AiAnalysis`

## Modulos e rotas

- `/dashboard`: visao executiva com KPIs e graficos
- `/vehicles`: lista de lotes/veiculos
- `/vehicles/new`: cadastro manual + importacao por link
- `/vehicles/[id]`: detalhe completo do veiculo com abas/secoes
- `/simulator`: simulador de arremate
- `/market-research`: pesquisa de mercado
- `/finance`: financeiro completo, livro razao, contas, centros de custo e gastos legados
- `/expenses`: rota antiga mantida para compatibilidade com o modulo de gastos legado
- `/processes`: kanban operacional
- `/documents`: repositorio de documentos
- `/photos`: galeria global
- `/suppliers`: fornecedores
- `/sales`: comercial, vendas e templates de WhatsApp
- `/reports`: relatorios e exportacoes
- `/settings`: configuracoes administrativas

## Lot importer

A camada `LotImporter` foi criada para permitir multiplas leiloeiras.

Ja existe:

- provider inicial para `Copart`
- fallback generico resiliente

Fluxo implementado:

1. recebe o link;
2. tenta capturar dados publicos;
3. se a captura falhar, salva o lote incompleto;
4. cria `Vehicle` e `LotSnapshot`;
5. registra alertas e pendencias;
6. permite complementacao manual depois.

Link de referencia utilizado no projeto:

- [Copart lote 1090276](https://www.copart.com.br/lot/1090276)

## IA e integracoes

Ja existe estrutura local/mock para:

- analise de risco do lote
- geracao de descricao comercial
- mensagens para WhatsApp
- provider de mercado
- publisher de anuncios

Essas camadas foram separadas para facilitar troca futura por:

- OpenAI API ou outro provedor de IA
- WhatsApp Business API
- APIs oficiais de mercado
- publicadores de portais

## Como rodar localmente

1. Instale dependencias:

```bash
npm install
```

2. Copie o arquivo de ambiente:

```bash
cp .env.example .env
```

No Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

3. Ajuste `DATABASE_URL` para seu PostgreSQL local.

4. Gere client/migration e aplique no banco:

```bash
npm run db:migrate
```

Em ambientes nao interativos ou producao, use:

```bash
npx prisma migrate deploy
```

5. Sincronize o livro razao financeiro sem apagar dados:

```bash
npm run finance:sync
```

Esse comando e idempotente. Ele usa `sourceType`, `sourceId` e `legacyReference` para evitar duplicidade quando executado mais de uma vez.

6. Popule dados demo somente em ambiente local/dev:

```bash
npm run db:seed
```

O seed recria dados demo e nao deve ser usado sobre banco real. Em producao ele e bloqueado por padrao; para rodar conscientemente seria necessario definir `ALLOW_DESTRUCTIVE_SEED=true`.

7. Rode o servidor:

```bash
npm run dev
```

8. Acesse:

- `http://localhost:3000`

## Credenciais demo

- admin: `admin@autoarremate.demo`
- senha: `Admin123!`

Outros usuarios seeded:

- `comprador@autoarremate.demo`
- `financeiro@autoarremate.demo`
- `operacional@autoarremate.demo`
- `vendas@autoarremate.demo`

Todos usam a senha:

- `Admin123!`

## Variaveis de ambiente

Veja [`.env.example`](C:/Users/carlo/Documents/Codex/2026-04-30/regra-principal-este-sistema-deve-ser/.env.example).

Principais:

- `DATABASE_URL`: PostgreSQL usado pelo Prisma. Em producao na Vercel, nunca use `localhost`; use a connection string do PostgreSQL online.
- `DATABASE_URL_UNPOOLED`: URL direta/unpooled usada pelo `directUrl` do Prisma. Configure junto com `DATABASE_URL` quando o provedor fornecer duas URLs.
- `NEXTAUTH_URL`: URL publica do ambiente. Localmente use `http://localhost:3000`; em producao use o dominio HTTPS da Vercel.
- `NEXTAUTH_SECRET`: segredo forte para assinar a sessao do NextAuth.
- `NEXT_PUBLIC_APP_URL`: opcional; use a URL publica caso alguma integracao client-side passe a precisar dela.
- `APP_DEMO_MODE`
- `STORAGE_DRIVER`
- `LOCAL_STORAGE_PATH`
- `SYSTEM_NAME`
- `COMPANY_NAME`
- `LOT_IMPORT_FETCH_TIMEOUT_MS`: timeout das chamadas externas da importacao de lote.
- `LOT_IMPORT_ENABLE_BROWSER_FALLBACK`: deixe `false` na Vercel. O fallback com navegador local depende de Chrome/Edge instalado e e indicado apenas para desenvolvimento/self-hosted.

### Vercel e producao

Para o site publicado funcionar, cadastre no painel da Vercel:

- `DATABASE_URL` apontando para um PostgreSQL online;
- `DATABASE_URL_UNPOOLED`, se o provedor disponibilizar URL direta/unpooled;
- `NEXTAUTH_URL` com o dominio publicado, por exemplo `https://seu-projeto.vercel.app`;
- `NEXTAUTH_SECRET` com valor seguro;
- `APP_DEMO_MODE`, `SYSTEM_NAME` e `COMPANY_NAME` conforme o ambiente;
- `STORAGE_DRIVER` e variaveis de storage externo quando uploads deixarem de usar disco local;
- `LOT_IMPORT_FETCH_TIMEOUT_MS`, se quiser ajustar o timeout padrao de 20s.

Depois de configurar um banco novo em producao, rode:

```bash
npx prisma migrate deploy
npm run finance:sync
```

Nao rode seed em producao para bases reais. O seed e destrutivo por natureza demo e fica bloqueado em `NODE_ENV=production` sem `ALLOW_DESTRUCTIVE_SEED=true`.

### Migracao financeira segura

A migration `20260510120000_add_financial_ledger` e apenas aditiva: cria novas tabelas, enums, indices e relacionamentos. Ela nao usa `DROP`, nao apaga tabelas antigas e nao altera registros antigos.

Mapeamento preservado:

- `Expense` vira `FinancialEntry` de saida com `sourceType=EXPENSE` e cria/atualiza `Payable`.
- Campos financeiros de `Vehicle` viram `FinancialEntry` com `sourceType=VEHICLE_CORE_COST` apenas quando ainda nao existem despesas antigas equivalentes.
- `Sale` vira `FinancialEntry` de entrada com `sourceType=SALE` e cria/atualiza `Receivable`.
- `CashFlow` vira `FinancialEntry` com `sourceType=CASHFLOW_LEGACY`; registros sem veiculo ou com valor anomalamente alto ficam com `isAnomalous=true` e nao entram nos calculos principais.
- Lancamentos novos manuais usam `sourceType=MANUAL`.

As tabelas `Vehicle`, `Expense`, `Sale`, `CashFlow`, `ExpenseCategory` e `Supplier` continuam existindo para compatibilidade. Os totais gravados em `Vehicle` passam a ser resumo derivado, recalculado a partir do livro razao e dos registros antigos sincronizados.

### Como testar o Financeiro

1. Rode `npx prisma generate`.
2. Rode `npx prisma migrate deploy` ou `npm run db:migrate` em desenvolvimento interativo.
3. Rode `npm run finance:sync`.
4. Abra `/finance` ou, por compatibilidade, `/expenses`.
5. Confira se os gastos antigos aparecem em Movimentacoes e Contas a Pagar.
6. Abra um veiculo existente em `/vehicles/[id]` e confira a secao "Financeiro do veiculo".
7. Crie uma nova despesa por veiculo; ela deve continuar salvando em `Expense` e sincronizar `FinancialEntry`.
8. Crie uma nova entrada/saida manual; ela deve nascer diretamente em `FinancialEntry`.
9. Rode `npm run build`.

## Dados de demonstracao incluidos

- 5 veiculos
- 3 leiloeiras
- 6 fornecedores
- snapshots
- fotos placeholder internas
- documentos ficticios
- gastos
- pesquisas de mercado
- simulacoes
- anuncios
- leads
- vendas concluidas
- analises de IA mockadas

## Suposicoes feitas

Estas suposicoes foram adotadas para nao interromper o desenvolvimento e devem permanecer editaveis no sistema:

1. O nome inicial do produto e `AutoArremate Gestao`, mas ele e alteravel por `Setting`.
2. O ambiente de desenvolvimento usa storage local, com abstracao preparada para trocar por S3/R2/Supabase.
3. A autenticacao usa credenciais internas com senha hasheada por `scrypt`.
4. A integracao real com IA nao foi acoplada ainda; a aplicacao usa heuristicas mockadas e registradas em `AiAnalysis`.
5. A pesquisa de mercado automatica foi deixada em camada abstrata e o fallback manual assistido ja funciona.
6. A importacao Copart foi implementada em modo resiliente; por bloqueio, CAPTCHA ou alteracao do HTML, ela pode retornar apenas dados parciais.
7. Pesos do score, margens alvo e branding foram colocados em `Setting`.
8. Sempre que um campo critico estiver ausente, o sistema deve seguir e salvar pendencias em vez de travar.

## Itens preparados para integracao futura

- `MarketPriceProvider` para FIPE/Webmotors/Mobiauto/OLX
- `AdvertisementPublisher` para OLX/Webmotors/Mobiauto/Instagram/Facebook Marketplace
- mensagens e historico estruturado para WhatsApp
- storage externo
- enrichment real por IA
- automacao de importacao por novas leiloeiras
- auditoria mais granular por entidade/evento

## Observacoes honestas sobre esta entrega

- O projeto foi montado de forma funcional em codigo, com schema Prisma, seed, paginas, CRUDs centrais, uploads, dashboards e servicos.
- A importacao por link roda no backend em `/api/lots/import`, com logs identificados por `[lot-import]` para consulta em Vercel > Functions > Logs.
- Em producao serverless, nao ha navegador local instalado para contornar bloqueios anti-bot. Se o site de origem bloquear a API estruturada e o HTML direto, o erro sera registrado nos logs e o fluxo deve seguir por cadastro manual ou por integracao oficial/proxy apropriado.

## Proximo passo recomendado

Depois de subir localmente, o passo mais valioso e:

1. executar `npm install`
2. rodar `npm run db:migrate`
3. rodar `npm run db:seed`
4. abrir o fluxo do lote Copart
5. validar importacao parcial, upload e recalculo de margem
## Importação por link da Copart

A sessão **Lotes / Veículos** permite colar um link da Copart Brasil, como:

```text
https://www.copart.com.br/lot/1107348
```

O backend extrai o número do lote e consulta os endpoints estruturados:

```text
https://www.copart.com.br/public/data/lotdetails/solr/{lotNumber}
https://www.copart.com.br/public/data/lotdetails/solr/lotImages/{lotNumber}
```

O fluxo primeiro mostra uma prévia editável com dados do veículo, lance, venda, características, documentos e fotos. Só depois do clique em **Salvar veículo** os dados são persistidos no banco. Após salvar, o LanceCerto usa o snapshot interno, os campos do veículo e as fotos gravadas, sem depender do link continuar disponível.

Campos principais mapeados: `ln` para código do lote, `mkn` marca, `lm` modelo, `versão` versão, `lcy` ano de fabricação, `my` ano modelo, `orr` FIPE, `la` quilometragem, `hk` chave, `stt` documento, `docType` código documental, `scn` comitente, `dtd` tipo de monta, `damageDesc` descrição de dano, `lt` condição, `yn` e `pyn` pátios, `aan` + `gr` lote/vaga, `ad` data de venda, `currBid` lance atual, `inc` incremento, `cuc` moeda, `trl` documentos, `scl` condições específicas e `tims` imagem principal.

As fotos vêm do endpoint `lotImages`. A importação normaliza URLs iniciadas com `//`, ordena por `sequenceNumber`, salva em `VehiclePhoto` com `source = copart`, usa a primeira imagem como principal e evita duplicar URLs já salvas para o mesmo veículo. Se a galeria falhar, o lote ainda pode ser salvo usando `tims` como imagem principal.

### ScrapingBee opcional

Se a Copart bloquear a chamada direta, o backend tenta os mesmos endpoints via ScrapingBee quando `SCRAPINGBEE_API_KEY` estiver configurada:

```env
SCRAPINGBEE_API_KEY=""
SCRAPINGBEE_RENDER_JS="true"
SCRAPINGBEE_WAIT_MS="5000"
SCRAPINGBEE_PREMIUM_PROXY="false"
SCRAPINGBEE_COUNTRY_CODE="br"
```

A chave fica apenas no backend. O fallback não usa a página visual `/lot/{lotNumber}` como fonte principal.

### Teste local e Vercel

Localmente, rode as migrations, gere o Prisma Client e suba o app:

```bash
npx prisma migrate dev
npx prisma generate
npm run dev
```

Na Vercel, configure `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET` e, opcionalmente, as variáveis `SCRAPINGBEE_*`. Depois faça deploy e teste a importação em **Lotes / Veículos** com `https://www.copart.com.br/lot/1107348`.

Limitações: a Copart pode bloquear requisições automatizadas; quando isso acontecer, use o preenchimento manual assistido ou configure ScrapingBee. Dados financeiros editados manualmente não devem ser sobrescritos sem escolher atualizar um veículo existente na prévia.
