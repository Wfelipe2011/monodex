# Integração front — lifecycle de scrape, on-demand e categorias

Handoff para o PWA/Next e Super Admin. Use **este arquivo + Swagger** (`swagger-spec.json` ou `GET /api` no gym-ctrl).

| | |
|--|--|
| **Change** | `scrape-lifecycle-on-demand-categories` |
| **Breaking** | **Sim.** `categories` em PUT/PATCH do outreach **tenant** só aceita valores retornados por GET eligible-categories (case-sensitive). Lista livre / texto manual → **400**. |
| **Auth** | JWT Bearer (`ADMIN` ou `SUPER_ADMIN` no tenant). Rotas platform inalteradas para bypass de categorias (Super Admin). |
| **Postman** | Pastas **Tenant — Scrape**, **Tenant — Outreach**, **Platform — Coverage** em `postman/monodex.postman_collection.json` |

---

## TL;DR

1. **Outreach:** antes de salvar `categories`, chame `GET /tenant/:tenantId/outreach-config/eligible-categories` e restrinja o UI ao conjunto `categories[]` (use `items[]` para agrupar por cidade).
2. **On-demand scrape:** até **2** runs/dia/tenant/target (fuso America/Sao_Paulo). Mostre `runsUsedToday` / `dailyLimit` e progresso do cursor (`nextBairroIndex` / `bairroCount`). Respeite toggle `onDemandEnabled`.
3. **Expectativa de produto:** on-demand **não** repõe o pool de leads de outreach de imediato; avança fatias de bairros via cursor. Planned lifecycle (`BOOTSTRAP` → 90d → 180d) é independente.
4. **Super Admin:** coverage em `/platform/scrape-coverages` expõe fase agendada e próxima run planned.

---

## Breaking — categorias de outreach

| Superfície | Antes | Agora |
|------------|-------|-------|
| PUT/PATCH `/tenant/:tenantId/outreach-config` | `categories` livre | Deve ser subconjunto de eligible-categories |
| UI multiselect | Catálogo estático / digitável | Só opções do GET eligible |
| Platform PATCH outreach | Regras existentes | Bypass city-filter **só** na rota platform (Super Admin), conforme spec |

### GET eligible-categories

```http
GET /tenant/:tenantId/outreach-config/eligible-categories
Authorization: Bearer <tenantToken>
```

**200** (exemplo):

```json
{
  "categories": ["Construtoras", "Restaurantes"],
  "items": [
    { "category": "Construtoras", "cityId": 1, "cityName": "Taubaté" }
  ]
}
```

| Código | Quando |
|--------|--------|
| **400** | PATCH/PUT tenant com `categories` fora da allowlist — corpo `Categorias inválidas: ...` |
| **403** | JWT de outro tenant |
| **404** | Tenant inexistente |

---

## Admin PWA — scrape on-demand (tenant)

Tag Postman: **Tenant — Scrape**.

| Método | Path | Notas |
|--------|------|-------|
| GET | `/tenant/:tenantId/scrape-targets` | Pares vinculados (id = `scrapeTargetId`) |
| POST | `/tenant/:tenantId/scrape-targets` | Pedir par `{ cityName, state?, category }` — não dispara scrape |
| GET | `/tenant/:tenantId/scrape-targets/:targetId/on-demand` | Status quota + cursor |
| POST | `/tenant/:tenantId/scrape-targets/:targetId/on-demand` | Dispara run curta |
| PATCH | `/tenant/:tenantId/scrape-targets/:targetId/on-demand` | `{ "onDemandEnabled": boolean }` |

### UX recomendada

- Botão **Scrape agora:** desabilitado se `runsUsedToday >= dailyLimit`, `onDemandEnabled === false`, ou enquanto loading.
- Label: **"Runs hoje: {runsUsedToday}/{dailyLimit}"** (limite fixo 2).
- Barra ou texto: **"Bairros: {nextBairroIndex} de {bairroCount}"** — segunda run no mesmo dia deve avançar o índice (evidência de cursor).
- Após POST 200, atualize status via GET; **não** prometa refresh instantâneo do funil de outreach — leads novos entram conforme captura/notifly.
- Erros: **429** quota → toast "Limite diário atingido"; **409** lock ou on-demand off → "Scrape em andamento ou desabilitado"; **400** cidade fora da policy.

### Códigos POST on-demand

| Código | Quando |
|--------|--------|
| **200** | `{ status, leadsTouched, bairrosProcessed, nextBairroIndex }` |
| **400** | Cidade fora da send-policy |
| **404** | Sem vínculo tenant×target |
| **409** | Lock do par `(cityId, category)` ou on-demand desabilitado (tenant ou plataforma) |
| **429** | Terceira tentativa no mesmo dia (SP) |
| **503** | Backend captura não configurado |

---

## Super Admin — coverage lifecycle

Tag Postman: **Platform — Coverage**.

```http
GET /platform/scrape-coverages?cityId=&category=
Authorization: Bearer <platformToken>
```

Campos novos por item: `schedulePhase`, `nextScheduledRunAt`, `scheduledRunCount`, `lastRunKind` (`planned` | `on_demand`), além dos existentes `lastRunAt`, `lastStatus`, `lastLeadCount`, `firstRunAt`, `city`.

Fases: `BOOTSTRAP` (planned até `lastLeadCount >= 1`) → `COOLDOWN_90D` → `RECURRING_180D` (180d entre runs planned).

---

## Checklist manual (stack local)

Pré-requisitos: `gym-ctrl`, `captura`, Postgres; env `CAPTURA_BASE_URL`, `CAPTURA_INTERNAL_SCRAPE_SECRET`; cron scrape ou trigger manual; opcional `SCRAPE_BUSINESS_HOURS_MAX_TARGETS=2`.

1. **BOOTSTRAP planned** — Par enabled sem leads: force ou aguarde cron planned; confirme runs até `lastLeadCount >= 1` em GET `/platform/scrape-coverages` (`schedulePhase` permanece `BOOTSTRAP` enquanto zero leads).
2. **Cooldown 90d** — Após run planned com `lastLeadCount >= 1`, coverage → `COOLDOWN_90D` e `nextScheduledRunAt` ~+90d. Planned seguinte **skipped** até a data (teste: ajuste `nextScheduledRunAt` no DB para passado e rode cron).
3. **Quota on-demand** — Dois POST `/tenant/.../scrape-targets/:id/on-demand` no mesmo dia (SP) → 200; terceiro → **429**.
4. **Cursor** — Compare `nextBairroIndex` no GET status antes/depois da 2ª run; logs captura devem mostrar bairros diferentes da 1ª fatia.
5. **Categoria inválida** — PATCH outreach tenant com categoria fora de eligible → **400**.
6. **Cap horário comercial** — Entre 08h–18h SP, com vários targets elegíveis, um tick do cron planned processa no máximo **K** pares (`SCRAPE_BUSINESS_HOURS_MAX_TARGETS`, default 2); confira logs/contagem de runs no tick.

---

## Regenerar Swagger

```bash
npx ts-node -r tsconfig-paths/register apps/gym-ctrl/src/generate-swagger-spec.ts
```
