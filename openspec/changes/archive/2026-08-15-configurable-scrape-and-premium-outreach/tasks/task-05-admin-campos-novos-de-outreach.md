# Task 5 — Admin — campos novos de outreach

**Change:** `configurable-scrape-and-premium-outreach`
**Grupo:** 5 de 8
**Pré-requisitos:** [1](./task-01-schema-e-migration.md)
**Desbloqueia:** [7](./task-07-postman-seeds-e-contratos.md)

## Objetivo do grupo

A API SUPER_ADMIN de outreach config lê e grava `leadsPerRun`, `headerImageUrl` e `sendIntervalSeconds` com os mesmos guards de enable já existentes.

## Contexto para o subagent

- Controller: `apps/gym-ctrl/src/modules/admin/outreach-config.controller.ts` — PUT/PATCH/GET, `RolesAuth(SUPER_ADMIN)`, `rejectSecretTokenFields`.
- Service: `apps/gym-ctrl/src/modules/admin/outreach-config.service.ts` — `upsert` create/update lista campos explicitamente; `patch` merged + spread condicional. **Incluir os três campos nos dois caminhos**.
- DTOs:
  - `apps/gym-ctrl/src/modules/admin/dto/upsert-outreach-config.dto.ts`
  - `apps/gym-ctrl/src/modules/admin/dto/patch-outreach-config.dto.ts`
- PUT: campos novos **opcionais** com default (leadsPerRun 5, sendIntervalSeconds 5, headerImageUrl omitido = null). PATCH: só se enviados.
- Validação class-validator (já usado):
  - `leadsPerRun`: `@IsInt()` `@Min(1)`
  - `sendIntervalSeconds`: `@IsInt()` `@Min(0)`
  - `headerImageUrl`: `@IsOptional()` `@IsUrl({ require_protocol: true, protocols: ['https'] })` — se a lib reclamar de `protocols`, validar no service `startsWith('https://')` e 400.
- `assertEnableAllowed` **não** precisa dos knobs novos para enable (não são condição de readiness).
- GET já devolve o model Prisma inteiro — os campos novos saem de graça se o client estiver gerado.
- Não mexer em WhatsApp accounts.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/gym-ctrl/src/modules/admin/dto/upsert-outreach-config.dto.ts` | editar |
| `apps/gym-ctrl/src/modules/admin/dto/patch-outreach-config.dto.ts` | editar |
| `apps/gym-ctrl/src/modules/admin/outreach-config.service.ts` | editar |

---

## 5.1 — DTOs e service

### O que fazer

Adicionar os três campos nos DTOs (ApiProperty/ApiPropertyOptional, exemplos: leadsPerRun 5, sendIntervalSeconds 5, headerImageUrl `https://example.com/header.png`).

Em `upsert` `create`/`update`: persistir `leadsPerRun: dto.leadsPerRun ?? 5`, `sendIntervalSeconds: dto.sendIntervalSeconds ?? 5`, `headerImageUrl: dto.headerImageUrl ?? null`.

Em `patch` merged e `data`: só aplicar se `!== undefined`.

400 se `leadsPerRun < 1` ou `sendIntervalSeconds < 0` (class-validator deve bastar com ValidationPipe já no controller).

### Critérios de aceite

- [ ] PUT sem os três campos grava 5 / null / 5
- [ ] PATCH `{ leadsPerRun: 10 }` não zera intervalo/imagem
- [ ] PUT `leadsPerRun: 0` → 400
- [ ] URL http:// (não https) rejeitada se headerImageUrl enviado

### Não fazer

- Não exigir os três campos no enable
- Não aceitar token Meta no body (já tem rejectSecretTokenFields)

---

## 5.2 — GET devolve knobs

### O que fazer

Confirmar que GET `/admin/tenants/:id/outreach-config` inclui os campos (Prisma return). Se houver `select` explícito (hoje não há), incluir.

Swagger `@ApiProperty` nos DTOs de resposta não é obrigatório (controller devolve o model); documentar nos ApiOperation do PUT/PATCH que os campos existem.

### Critérios de aceite

- [ ] GET após PUT mostra `leadsPerRun`, `headerImageUrl`, `sendIntervalSeconds`

### Não fazer

- Não criar DTO de response separado só por isso, a menos que o módulo já use essa regra

---

## Verificação do grupo

- PUT/PATCH/GET manuais (ou leitura do service) cobrem defaults e validação
- `outreach-config.service.ts` create/update/patch listam os três campos

## Handoff para próxima task

Grupo 6 adiciona scrape admin sem alterar outreach. Grupo 7 atualiza Postman com os bodies novos.
