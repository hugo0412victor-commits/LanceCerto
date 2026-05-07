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
- `/expenses`: financeiro por gasto
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

5. Popule dados demo:

```bash
npm run db:seed
```

6. Rode o servidor:

```bash
npm run dev
```

7. Acesse:

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

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `APP_DEMO_MODE`
- `STORAGE_DRIVER`
- `LOCAL_STORAGE_PATH`
- `SYSTEM_NAME`
- `COMPANY_NAME`

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
- Neste ambiente de trabalho, o runtime Node/Prisma nao ficou livre o bastante para eu executar `npm install`, `prisma migrate` e `next build` ate o fim.
- Por isso, o codigo foi preparado e documentado para execucao local, mas a geracao efetiva da migration e a validacao final de runtime devem ser feitas por voce ao rodar os comandos acima.

## Proximo passo recomendado

Depois de subir localmente, o passo mais valioso e:

1. executar `npm install`
2. rodar `npm run db:migrate`
3. rodar `npm run db:seed`
4. abrir o fluxo do lote Copart
5. validar importacao parcial, upload e recalculo de margem
