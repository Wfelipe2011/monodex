## Context

Hoje `CapturaScraperService.handleMorningScrape()` carrega todos `ScrapeTarget` com `enabled=true`, agrupa por cidade e executa serialmente com mutex global `running`. `ScrapeCoverage` grava `lastRunAt`, `lastStatus`, `lastLeadCount` mas **não** influencia elegibilidade — conforme spec atual de `scrape-catalog`.

Tenants pedem pares via `TenantScrapeTargetsService.request` (upsert global, link por tenant). Outreach usa `TenantOutreachConfig.categories` livre; filtro de cidade acontece no notifly via `TenantSendPolicy`.

Decisões de produto (exploração):

1. Primeira fase agendada: continuar tentando até uma run agendada registrar `lastLeadCount >= 1`; então **cooldown 90d**, depois **1 run**, depois ciclo **180d**.
2. On-demand tenant: run curta, não mexe no cooldown agendado, max **2/dia/tenant/target**, cursor para não repetir bairros; desabilitável por target.
3. Scrape permanece global.
4. Categorias outreach = união derivada de targets (restrito).
5. Capacidade agendada menor das 08h–18h (America/Sao_Paulo).

## Goals / Non-Goals

**Goals:**

- Cron agendado scrape só pares elegíveis (lifecycle + enabled).
- On-demand paralelo conceitual (fila/worker) com limites de duração e quota.
- Cursor persistido por `(tenantId, scrapeTargetId)` para fatias de bairros.
- GET allow-list + validação **BREAKING** em writes de `categories`.
- Horário comercial reduz throughput de **planned** only.

**Non-Goals:**

- Cobrar coins por on-demand scrape (futuro).
- UI web; só API + Postman + FRONT-INTEGRATION snippet se necessário.
- Multi-browser farm / fila distribuída Redis (single captura process com locks finos).
- Re-scrape automático quando pool de outreach esgota (fora desta change).

## Decisions

### D1 — Lifecycle agendado em `ScrapeCoverage`

**Campos novos (nomes sugeridos):**

| Campo | Tipo | Uso |
|-------|------|-----|
| `schedulePhase` | enum | `BOOTSTRAP` → `COOLDOWN_90D` → `RECURRING_180D` |
| `nextScheduledRunAt` | DateTime? | Próxima elegibilidade no cron planned |
| `scheduledRunCount` | Int | Runs agendadas concluídas (telemetria) |

**Transições (planned runs only):**

```
BOOTSTRAP
  on planned complete:
    if lastLeadCount >= 1 → COOLDOWN_90D, nextScheduledRunAt = now + 90d
    else stay BOOTSTRAP (eligible every cron tick subject to capacity)

COOLDOWN_90D
  when now >= nextScheduledRunAt and planned runs:
    execute once → RECURRING_180D, nextScheduledRunAt = now + 180d

RECURRING_180D
  when now >= nextScheduledRunAt:
    execute once → nextScheduledRunAt = now + 180d
```

`lastLeadCount` continua sendo o contador já existente no captura (leads touched no par naquela run). Runs com status `failed` ainda atualizam coverage mas **não** avançam fase se `lastLeadCount = 0`.

**Backfill migration:** targets com coverage existente e `lastLeadCount >= 1` entram em `COOLDOWN_90D` com `nextScheduledRunAt = lastRunAt + 90d` (ou `now + 90d` se `lastRunAt` muito antigo — usar `max(lastRunAt+90d, now)` para evitar storm). Sem coverage → `BOOTSTRAP`.

### D2 — Seleção no cron planned + capacidade comercial

Substituir `findMany({ enabled: true })` por query:

- `enabled = true`
- `schedulePhase = BOOTSTRAP` **OR** `nextScheduledRunAt <= now()`
- Join coverage por `(cityId, category)`; se coverage ausente, tratar como BOOTSTRAP.

**Capacidade (08:00–18:00 America/Sao_Paulo):** processar no máximo **K** pares `(cityId, category)` por tick do cron (default K=2, configurável via env `SCRAPE_BUSINESS_HOURS_MAX_TARGETS` ou row em config plataforma). Fora da janela: sem limite adicional além do serial por cidade existente.

Ordem: `nextScheduledRunAt ASC NULLS FIRST`, depois `lastRunAt ASC` para fairness.

Lock: mutex por `(cityId, category)` além do global — on-demand e planned não rodam o mesmo par simultaneamente.

### D3 — On-demand tenant (execução curta)

**Nova tabela `ScrapeOnDemandState`** (unique `tenantId + scrapeTargetId`):

- `bairroOrder` JSON: array ordenado de nomes de bairro snapshot na primeira run (ou hash + index).
- `nextBairroIndex` Int default 0.
- `onDemandEnabled` Boolean default true (tenant pode PATCH off; super-admin pode forçar off no target global opcional `onDemandAllowed` em `ScrapeTarget`).

**Nova tabela `ScrapeOnDemandRun`** (log + quota):

- `tenantId`, `scrapeTargetId`, `startedAt`, `finishedAt`, `status`, `leadsTouched`, `bairrosProcessed`.

Quota: contar runs com `startedAt` no dia civil America/Sao_Paulo; se `count >= 2` → HTTP 429.

**Execução:** gym-ctrl valida link tenant↔target, policy de cidade, quota, flags; enfileira job interno (HTTP para captura `POST /internal/scrape/on-demand` com secret) **ou** grava fila DB lida pelo captura — preferir **HTTP interno** espelhando padrão notify se existir; senão **row `ScrapeJobQueue`**.

Limites da run curta (constants env):

- `ON_DEMAND_MAX_BAIRROS = 3` bairros a partir de `nextBairroIndex`.
- `ON_DEMAND_MAX_SCROLL_MS` ou reutilizar scroll reduzido no feed.
- Single category (o do target).

Após run: incrementar `nextBairroIndex`; se esgotou bairros, reset index 0 e re-shuffle opcional (documentar: wrap-around continua busca fresca em outros bairros).

**Importante:** on-demand **não** altera `schedulePhase` / `nextScheduledRunAt`; opcionalmente atualiza `ScrapeCoverage.lastRunAt` com flag `runKind=on_demand` em coluna `lastRunKind` para observabilidade only.

### D4 — Categorias aceitáveis para outreach

Função compartilhada (package `@core/shared` ou service gym-ctrl):

```
eligibleCategories(tenantId) =
  DISTINCT ScrapeTarget.category
  WHERE enabled = true
  AND cityId passes cityAllowed(tenant send policy)
  AND (
    EXISTS TenantScrapeTarget(tenant, target)
    OR target created by platform (always include if city allowed)
  )
```

Como não há flag “público” separada e scrape é global: **qualquer** `ScrapeTarget` enabled cuja cidade está na política do tenant entra na allow-list (pedidos próprios + pedidos de outros + platform). Isso alinha com pool global de leads.

**GET** `tenant/:tenantId/outreach-config/eligible-categories` (ou sub-resource existente).

**PUT/PATCH** tenant outreach: cada string em `categories` deve ∈ allow-list; senão 400. **BREAKING:** bootstrap super-admin também valida; migration script opcional trim inválidas (preferir falha explícita no PATCH e documentar cleanup).

Platform PUT de categorias: super-admin bypass? **Não** — usar união de todas categorias enabled (operacional) ou bypass só SUPER_ADMIN platform route. Decisão: **tenant routes restritas**; **platform** `/platform/tenants/:id/outreach-config` pode setar qualquer categoria enabled globalmente para não bloquear ops.

### D5 — APIs

| Método | Rota | Quem |
|--------|------|------|
| POST | `tenant/:tenantId/scrape-targets/:targetId/on-demand` | ADMIN |
| GET | `tenant/:tenantId/scrape-targets/:targetId/on-demand` | ADMIN (quota, cursor, last run) |
| PATCH | `tenant/:tenantId/scrape-targets/:targetId/on-demand` | ADMIN `{ enabled: false }` |
| GET | `tenant/:tenantId/outreach-config/eligible-categories` | ADMIN |
| GET | `platform/scrape-coverages` estendido | SUPER_ADMIN (phase, next run) |

Captura: `POST /internal/scrape/on-demand` body `{ scrapeTargetId, tenantId, mode: 'short' }`.

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| Backfill coloca muitos targets em cooldown simultâneo | Espalhar `nextScheduledRunAt` com jitter de até 7d no backfill |
| BOOTSTRAP forever se Maps nunca retorna leads | Alerta ops via `lastRunAt`; manual super-admin PATCH phase (future) |
| On-demand + planned lock contention | Lock por par; on-demand falha 409 retry |
| BREAKING categories | GET allow-list antes do PATCH; doc FRONT-INTEGRATION |
| Cron único tick processa K=2 → fila cresce | Fora comercial processa mais; monitor queue depth |

## Migration Plan

1. Prisma migration + backfill coverage phases.
2. Deploy captura + gym-ctrl juntos.
3. Comunicar tenants: revisar `categories` contra novo GET.
4. Rollback: reverter deploy; fase nova ignorada se código antigo (enabled=all).

## Open Questions

- Valor default K em horário comercial (proposta: 2).
- Platform outreach PUT bypass allow-list — confirmado sim para SUPER_ADMIN platform routes only.
