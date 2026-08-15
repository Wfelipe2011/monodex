# Task 6 — Admin — API de scrape targets e coverage

**Change:** `configurable-scrape-and-premium-outreach`
**Grupo:** 6 de 8
**Pré-requisitos:** [1](./task-01-schema-e-migration.md)
**Desbloqueia:** [7](./task-07-postman-seeds-e-contratos.md)

## Objetivo do grupo

SUPER_ADMIN gerencia `ScrapeTarget` (cidade × categoria) e lê `ScrapeCoverage`. Create **não** dispara Puppeteer.

## Contexto para o subagent

- Módulo: `apps/gym-ctrl/src/modules/admin/`. Padrão: controller + service + dto, `@RolesAuth(Roles.SUPER_ADMIN)`, `@UsePipes(ValidationPipe({ whitelist: true, transform: true }))`, `@ApiTags` / `@ApiBearerAuth`.
- Espelhar `whatsapp-accounts.controller.ts` (CRUD simples de plataforma).
- Registrar em `apps/gym-ctrl/src/modules/admin/admin.module.ts` (`controllers` + `providers`).
- `City` não tem unique em `name`. Resolver: `findFirst({ name, state })` se state enviado; senão `findFirst({ name })`; create se não houver. Não duplicar se já existir o mesmo name.
- Unique Prisma de target: `cityId_category`.
- Delete: `DELETE` físico **ou** `enabled=false`. Preferir PATCH enabled + DELETE físico opcional. Spec pede disable/delete — implementar PATCH enabled e DELETE (remove row; coverage permanece).
- Coverage: GET lista, include `city` (id, name, state). Query opcional `cityId`, `category`.
- `rejectSecretTokenFields` no POST/PATCH por consistência.
- Não importar captura/Puppeteer no gym-ctrl.

Rotas:

```
POST   /admin/scrape-targets
GET    /admin/scrape-targets
GET    /admin/scrape-targets/:id
PATCH  /admin/scrape-targets/:id
DELETE /admin/scrape-targets/:id
GET    /admin/scrape-coverages
```

POST body:

```json
{
  "cityName": "Taubaté",
  "state": "SP",
  "category": "Construtoras",
  "enabled": true
}
```

`state` e `enabled` opcionais (`enabled` default true). `cityName` e `category` required, `@MinLength(1)`.

POST no par existente: upsert (atualizar `enabled` se enviado), 200, sem segunda row.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/gym-ctrl/src/modules/admin/scrape-targets.controller.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/scrape-targets.service.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/dto/create-scrape-target.dto.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/dto/patch-scrape-target.dto.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/scrape-coverages.controller.ts` | criar (ou endpoints no mesmo controller) |
| `apps/gym-ctrl/src/modules/admin/scrape-coverages.service.ts` | criar se separado |
| `apps/gym-ctrl/src/modules/admin/admin.module.ts` | editar |

Pode ser um único `ScrapeCatalogController` com as duas resources se ficar mais limpo — desde que as URLs sejam as da spec.

---

## 6.1 — CRUD de ScrapeTarget

### O que fazer

Service:

- `list()`: findMany include city, orderBy city.name / category
- `create(dto)`: resolve/cria City; `upsert` where `cityId_category`
- `getById`: 404 se não achar
- `patch(id, { enabled?, category? })`: se mudar category, respeitar unique (409/400 se colidir)
- `delete(id)`: 404 se não achar; delete o target, **não** apagar coverage nem city

Não chamar scraper.

### Critérios de aceite

- [ ] POST cidade nova cria `City` + `ScrapeTarget` enabled
- [ ] POST duplicado não cria segunda row
- [ ] PATCH `{ enabled: false }` faz o cron (grupo 2) pular o par
- [ ] DELETE remove o target; coverage rows permanecem
- [ ] Sem SUPER_ADMIN → 403 (mesmo guard do resto do admin)
- [ ] Create não abre browser / não importa `puppeteer`

### Não fazer

- Não `POST /admin/scrape-targets/:id/run`
- Não apagar `Neighborhood` ao deletar target

---

## 6.2 — GET coverage

### O que fazer

`GET /admin/scrape-coverages` → findMany include city. Query opcional `cityId` (ParseIntPipe optional), `category` string.

Somente leitura — sem PATCH/DELETE.

### Critérios de aceite

- [ ] Lista vazia `[]` se nunca scrapou
- [ ] Após um scrape (grupo 2), o GET mostra `lastStatus` / `lastRunAt` / `lastLeadCount` / `firstRunAt`

### Não fazer

- Não permitir update de coverage pela API
- Não filtrar coverage por tenant

---

## 6.3 — Module wiring

### O que fazer

Importar controllers/services em `AdminModule`. Não quebrar health/ops/tenants.

### Critérios de aceite

- [ ] App gym-ctrl sobe; rotas novas no Swagger (`ApiTags` ex. `Admin — Scrape`)
- [ ] `admin.module.ts` lista os novos providers

### Não fazer

- Não criar módulo Nest separado fora de `admin/` nesta change

---

## Verificação do grupo

- POST target Taubaté + Construtoras; GET lista; PATCH disable; GET coverage (vazio ok)
- Confirmar que o ficheiro de service não referencia `captura` / `puppeteer`

## Handoff para próxima task

Postman (grupo 7) documenta estas rotas. Captura (grupo 2) já lê `ScrapeTarget` — a API é a forma de popular o catálogo além do seed.
