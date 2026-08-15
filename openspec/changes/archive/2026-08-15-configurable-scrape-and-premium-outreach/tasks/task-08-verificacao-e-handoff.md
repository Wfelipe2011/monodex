# Task 8 — Verificação e handoff

**Change:** `configurable-scrape-and-premium-outreach`
**Grupo:** 8 de 8
**Pré-requisitos:** [2](./task-02-captura-identidade-upsert-e-catalogo.md), [4](./task-04-notifly-mix-premium-e-dedup-de-phone.md), [7](./task-07-postman-seeds-e-contratos.md)
**Desbloqueia:** nenhum

## Objetivo do grupo

Confirmar que não restaram hardcodes proibidos, que o schema valida, e que o fluxo ponta a ponta (catálogo → upsert → mix → intervalo → admin) está operacional ou documentado onde for só manual.

## Contexto para o subagent

- Change dir: `openspec/changes/configurable-scrape-and-premium-outreach/`.
- Design: `../design.md`. Specs em `../specs/`.
- Não implementar features novas. Corrigir regressões óbvias dos grupos anteriores se o grep falhar (ex. `findUnique({ phone })` esquecido).
- Baileys `apps/captura/src/leads.service.ts` **pode** ainda ter filtro de website e `slice` — está fora de escopo; não “consertar” nesse arquivo.
- `WHATSAPP_OUTREACH_HEADER_IMAGE_URL` no `.env` permanece como fallback.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| nenhum obrigatório | só correções pontuais se grep falhar |

---

## 8.1 — Grep de regressão

### O que fazer

Rodar buscas e zerar hits **proibidos**:

| Padrão | Onde NÃO pode |
|--------|----------------|
| `SCRAPE_CITY` / `SCRAPE_CATEGORIES` / `ONE_SHOT_EVENING_DATE` | `apps/captura` |
| `slice(0, 5)` como cap de outreach | `apps/notifly/src/leads.service.ts` |
| `website: ''` / `contains: 'facebo'` no `where` de `contactLeads` | `apps/notifly/src/leads.service.ts` |
| `lead.findUnique({ where: { phone:` (sem cityId) | `apps/captura` |
| `phone String @unique` em `model Lead` | `prisma/schema.prisma` |

Hits **permitidos**: filtro website em `apps/captura/src/leads.service.ts` (legado); comentários.

Confirmar hits **obrigatórios**:

- `leadsPerRun`, `sendIntervalSeconds`, `headerImageUrl` em schema + outreach service
- `ScrapeTarget` / `ScrapeCoverage` no schema
- `@@unique([phone, cityId])` no Lead
- `sendIntervalSeconds` usado com `setTimeout` / sleep no notifly

### Critérios de aceite

- [ ] Tabela proibida sem hits nos paths indicados
- [ ] Tabela obrigatória com hits

### Não fazer

- Não refatorar Baileys
- Não apagar a env de imagem

---

## 8.2 — Validate e checklist manual

### O que fazer

1. `npx prisma validate` (e generate se necessário).
2. Checklist (executar o que o ambiente permitir; o restante documentar como passo manual no output do grupo):

- [ ] Migration aplicada; leads antigos têm `city_id` e `categories` não vazio
- [ ] Seed scrape: Pindamonhangaba × Construtoras
- [ ] POST admin target segunda cidade; GET lista
- [ ] Re-scrape (ou persistência unitária): mesmo phone mesma cidade atualiza rating; phone em duas cidades = duas rows
- [ ] `contactLeads`: log X/P/R/Y; dois clones de phone não saem no mesmo lote
- [ ] Intervalo ~5s entre POSTs Graph (log timestamps)
- [ ] PUT outreach `leadsPerRun=10` altera o cap
- [ ] GET coverages após um run (ou mock de upsert coverage)

### Critérios de aceite

- [ ] `prisma validate` ok
- [ ] Itens do checklist feitos ou explicitamente marcados como “requer Maps/Meta live”

### Não fazer

- Não abrir PR
- Não alterar specs/design nesta task salvo correção factual mínima se algo ficou impossível

---

## Verificação do grupo

Este grupo **é** a verificação. Falhas de grep → corrigir no ficheiro culpado e re-rodar.

## Handoff para próxima task

Change pronta para archive após uso em produção. Follow-ups conscientes (non-goals): rotação de scrape por `lastRunAt`, filtro de outreach por cidade, jitter de intervalo, UI.
