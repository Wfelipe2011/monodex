# Task 2 — Captura — identidade, upsert e catálogo

**Change:** `configurable-scrape-and-premium-outreach`
**Grupo:** 2 de 8
**Pré-requisitos:** [1](./task-01-schema-e-migration.md)
**Desbloqueia:** [8](./task-08-verificacao-e-handoff.md)

## Objetivo do grupo

O captura scrapa a partir de `ScrapeTarget` no banco, faz upsert de lead por `(phone, cityId)` acumulando categorias, e grava `ScrapeCoverage`. Sem constantes de cidade/categoria no código.

## Contexto para o subagent

- App: `apps/captura`.
- Persistência atual (skip se phone existe) em `apps/captura/src/captura-scraper.service.ts` (~linhas 113–148): `findUnique({ where: { phone: cleanPhone } })` — **quebra** após unique composto; substituir.
- Constantes a remover no mesmo arquivo: `SCRAPE_CITY`, `SCRAPE_CATEGORIES`, `ONE_SHOT_EVENING_DATE`, método `handleEveningScrapeOnce`.
- Cron manhã: `@Cron('0 6 * * *', { timeZone: 'America/Sao_Paulo' })` — manter horário; mudar a fonte da lista.
- Scraper Maps: `apps/captura/src/scraper/google-maps.scraper.ts` — `scrapeSorocabaLeads(city, categories, bairros, cb)`. Pode permanecer a assinatura; o service passa `city.name` e as categorias dos targets daquela cidade.
- Bairros: já busca `neighborhood` por `cityId`; se vazio chama `GoogleMapsNeighborhoodScraper.scraper(cityName)`.
- Lock `this.running` já existe — manter.
- Soft-delete: se `deletedAt` setado, **não** update e **não** create.
- Phone: `replace(/[^0-9]/g, '')`; skip se vazio (já existe).
- **Não** alterar `apps/captura/src/leads.service.ts` (Baileys legado).
- Seed: novo script ou extensão pontual — um target Pindamonhangaba + `Construtoras`.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/captura/src/captura-scraper.service.ts` | editar |
| `prisma/seed-scrape-targets.ts` (ou equivalente) | criar |
| `apps/captura/src/scraper/google-maps.scraper.ts` | editar só se necessário para cityId/coverage |

---

## 2.1 — Upsert por (phone, cityId)

### O que fazer

No callback de persistência:

```ts
const existing = await this.prisma.lead.findUnique({
  where: { phone_cityId: { phone: cleanPhone, cityId: city.id } },
});
```

(Nome do unique Prisma: `phone_cityId` se `@@unique([phone, cityId])`.)

- Sem row → `create` com `cityId`, `category`, `categories: [category]`, name, website, rating, reviews.
- Row com `deletedAt` → skip (log).
- Row ativa → `update`: name, website, rating, reviews, `category` = categoria desta busca, `categories` = array único da união (`[...new Set([...existing.categories, category])]`). Se `categories` vier vazio, unir com `existing.category`.

O `city` do scrape em andamento deve estar no closure (id numérico).

### Critérios de aceite

- [ ] Nenhum `lead.findUnique({ where: { phone } })` no captura
- [ ] Re-scrape da mesma cidade atualiza rating/reviews
- [ ] Segunda categoria na mesma cidade acumula em `categories`
- [ ] Lead soft-deleted não é alterado nem duplicado

### Não fazer

- Não upsert por phone sozinho
- Não implementar Baileys / `leads.service.ts` do captura

---

## 2.2 — Cron lê ScrapeTarget

### O que fazer

1. Apagar `SCRAPE_CITY`, `SCRAPE_CATEGORIES`, `ONE_SHOT_EVENING_DATE`.
2. Remover `handleEveningScrapeOnce` e seu `@Cron`.
3. `handleMorningScrape` (ou sucessor) carrega:

```ts
await this.prisma.scrapeTarget.findMany({
  where: { enabled: true },
  include: { city: true },
});
```

4. Se lista vazia: log e return (não abrir Puppeteer).
5. Agrupar por `cityId`. Para cada cidade, `runScrapeJob` / `scrape(city.name, categoriesDaCidade)` passando o `city.id` para o persist.
6. `onModuleInit` log deve dizer que as fontes são `ScrapeTarget`, não a data one-shot.

### Critérios de aceite

- [ ] Grep `SCRAPE_CATEGORIES` / `SCRAPE_CITY` / `ONE_SHOT_EVENING_DATE` vazio em `apps/captura`
- [ ] Target disabled não entra no job
- [ ] Zero targets → no-op com log

### Não fazer

- Não disparar scrape no POST admin (grupo 6)
- Não reintroduzir lista hardcoded como fallback silencioso

---

## 2.3 — Bairros e ScrapeCoverage

### O que fazer

Manter o fluxo de neighborhoods por `cityId`; se vazio, `googleMapsNeighborhoodScraper.scraper(city.name)`.

Após processar as categorias de uma cidade (ou após cada categoria, se o loop permitir):

`prisma.scrapeCoverage.upsert` where `cityId_category: { cityId, category }`:

- create: `firstRunAt` = now, `lastRunAt` = now, `lastStatus`, `lastLeadCount`
- update: **não** mexer `firstRunAt`; atualizar `lastRunAt`, `lastStatus`, `lastLeadCount`

Status: `success` se o scrape daquele par não lançou; `failed` no catch da categoria; `partial` se alguns bairros falharam mas houve persistência (critério razoável: `failed` só quando a categoria inteira aborta).

Contar leads tentados/upserted naquele par para `lastLeadCount`.

O scraper atual chama `cb` por bairro; o service pode acumular contadores `Map<category, number>` no persist.

### Critérios de aceite

- [ ] Segunda execução do mesmo par preserva `firstRunAt` e atualiza `lastRunAt`
- [ ] Falha de uma categoria ainda persiste coverage com `lastStatus` não-sucesso
- [ ] Cidade nova sem bairros dispara neighborhood scraper existente

### Não fazer

- Não pular scrape com base em `lastRunAt` (sem política de rotação)
- Não criar tabela extra além de Coverage

---

## 2.4 — Seed de target inicial

### O que fazer

Script idempotente (ex. `prisma/seed-scrape-targets.ts`):

- `city.findFirst({ name: 'Pindamonhangaba' })` ou create
- `scrapeTarget.upsert` unique `cityId_category` com `category: 'Construtoras'`, `enabled: true`

Documentar no cabeçalho: `npx ts-node prisma/seed-scrape-targets.ts`.

Não seedar todas as categorias comentadas do arquivo antigo.

### Critérios de aceite

- [ ] Rodar duas vezes não duplica target
- [ ] Após o seed, o cron 06:00 tem exatamente esse par enabled (além de outros que o admin criar)

### Não fazer

- Não enabled=true em 6+ categorias de uma vez
- Não hardcodar o seed dentro do `onModuleInit` do captura

---

## Verificação do grupo

- Grep: `findUnique({ where: { phone` ausente em captura scraper
- Constantes `SCRAPE_*` removidas
- Seed cria um `ScrapeTarget`

## Handoff para próxima task

Notifly ainda não usa `cityId`/mix (grupos 3–4). Admin de targets é grupo 6; o cron já lê o que o admin gravar.
