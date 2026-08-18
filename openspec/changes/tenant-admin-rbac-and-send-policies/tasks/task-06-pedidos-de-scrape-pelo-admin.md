# Task 6 — Pedidos de scrape pelo Admin

**Change:** `tenant-admin-rbac-and-send-policies`
**Grupo:** 6 de 8
**Pré-requisitos:** [Task 1](./task-01-schema-e-migration.md), [Task 4](./task-04-superficie-tenant-operacional.md), [Task 5](./task-05-apis-de-send-policy-e-template-grants.md)
**Desbloqueia:** [Task 8](./task-08-postman-seeds-e-verificacao.md)

## Objetivo do grupo

Admin pede par cidade/categoria compartilhado, visível só nos próprios vínculos, respeitando allow/deny; par novo nasce enabled.

## Contexto para o subagent

- `ScrapeTargetsService` em `apps/gym-ctrl/src/modules/admin/scrape-targets.service.ts`: `resolveCity(cityName, state)` + `upsert` `cityId_category`. **Reusar** `resolveCity` (extrair se private).
- `CreateScrapeTargetDto`: `cityName`, `state?`, `category`, `enabled?`.
- Captura já lê `enabled` — não mudar captura.
- Platform list (grupo 3) continua todos os targets.
- `cityAllowed` em `libs/shared/send-policy.ts`.
- Policy ausente: tratar como arrays vazios (sem restrição). Opcional: `upsert` policy vazia on the fly.
- Spec: `tenant-scrape-requests`, `scrape-catalog`.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/gym-ctrl/src/modules/admin/tenant-scrape-targets.controller.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/tenant-scrape-targets.service.ts` | criar |
| `scrape-targets.service.ts` | editar se extrair resolveCity |
| `admin.module.ts` | editar |

---

## 6.1 — POST request

### O que fazer

`POST /tenant/:tenantId/scrape-targets` body `{ cityName, state?, category }` (sem `enabled` no body Admin).

Fluxo:

1. Scope + active guards.
2. `resolveCity` (cria City se preciso).
3. Carregar `TenantSendPolicy`; `cityAllowed(city.id, allowed, denied)` senão 400.
4. `scrapeTarget.upsert` where `cityId_category`.
   - **create:** `enabled: true`.
   - **update:** `{}` (não mexer `enabled`).
5. `tenantScrapeTarget.upsert` unique `(tenantId, scrapeTargetId)`.

### Critérios de aceite

- [ ] Par novo `enabled=true`
- [ ] Cidade fora do allow → 400 sem link
- [ ] Admin com denylist da cidade → 400

### Não fazer

- Não lançar Puppeteer
- Não re-enable no share

---

## 6.2 — Share não altera enabled

### O que fazer

Cobrir no service o branch update vazio. Teste manual/unitário: target id existente `enabled=false` + POST mesmo par → link criado, `enabled` continua false.

### Critérios de aceite

- [ ] `enabled` inalterado no share
- [ ] Segunda request mesmo tenant é idempotente (um link)

### Não fazer

- Não deletar coverage

---

## 6.3 — GET Admin vs Super Admin

### O que fazer

`GET /tenant/:tenantId/scrape-targets` include city, só `where: { tenantId }`. Platform GET (já grupo 3) sem filtro de link.

### Critérios de aceite

- [ ] Admin não vê target sem vínculo
- [ ] Super Admin `/platform/scrape-targets` vê todos

### Não fazer

- Não esconder `enabled` do Admin (eles precisam ver se o cron está parado)

---

## Verificação do grupo

Dois tenants pedem o mesmo par → um `ScrapeTarget`, dois `TenantScrapeTarget`.

## Handoff para próxima task

Notifly não depende deste grupo. Captura inalterado. Grupo 8 testa share + allowlist.
