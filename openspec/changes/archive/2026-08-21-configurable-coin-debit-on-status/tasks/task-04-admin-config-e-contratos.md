# Task 4 — Admin — config e contratos

**Change:** `configurable-coin-debit-on-status`
**Grupo:** 4 de 5
**Pré-requisitos:** [task-01](./task-01-schema-e-migration.md)
**Desbloqueia:** [task-05](./task-05-backfill-retroativo-e-verificacao.md) (docs de verificação)

## Objetivo do grupo

Super Admin configura `coinDebitOnStatus` por tenant; Admin tenant lê mas não escreve; contratos Swagger/Postman/FRONT atualizados.

## Contexto para o subagent

- `apps/gym-ctrl/src/modules/admin/outreach-config.service.ts`
  - `PLATFORM_OUTREACH_KEYS` = `costPerLead`, `cashbackOnReply`, `whatsappAccountId` — **adicionar** `coinDebitOnStatus`.
  - `patchPlatform` persiste só campos platform (~180–192).
  - `createTenant` / `patchTenant` usam `rejectForbiddenBodyKeys(rawBody, PLATFORM_OUTREACH_KEYS)`.
- DTO: `apps/gym-ctrl/src/modules/admin/dto/patch-platform-outreach-config.dto.ts`
- Controllers: `outreach-config.controller.ts` (paths `/platform/...` e `/tenant/...`).
- Ownership spec: `tenant-outreach-config` (campo platform-owned).
- Não há UI neste repo — escrever `FRONT-INTEGRATION.md` nesta change.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/gym-ctrl/src/modules/admin/dto/patch-platform-outreach-config.dto.ts` | editar |
| `apps/gym-ctrl/src/modules/admin/outreach-config.service.ts` | editar |
| DTOs swagger de response de outreach config (se existirem campos explícitos) | editar |
| `apps/gym-ctrl/.../outreach-config.service.spec.ts` | editar |
| Postman collection relevante | editar |
| `openspec/changes/configurable-coin-debit-on-status/FRONT-INTEGRATION.md` | criar |
| `swagger-spec.json` | regenerar se o repo versiona |

---

## 4.1 — PATCH platform escreve o gatilho

### O que fazer

1. Em `PatchPlatformOutreachConfigDto`, adicionar:
   ```ts
   @ApiPropertyOptional({ enum: ['sent', 'delivered', 'read'] })
   @IsOptional()
   @IsIn(['sent', 'delivered', 'read'])
   coinDebitOnStatus?: 'sent' | 'delivered' | 'read';
   ```
2. Incluir em `PLATFORM_OUTREACH_KEYS`.
3. Persistir em `patchPlatform` data update.
4. Garantir que path tenant rejeita o key no body (já via `rejectForbiddenBodyKeys`).

### Critérios de aceite

- [ ] Super Admin PATCH altera o valor
- [ ] Valor `failed` → 400
- [ ] Admin tenant com `coinDebitOnStatus` no body → 403

### Não fazer

- Não tornar o campo editável no DTO tenant-owned (`PatchOutreachConfigDto` / `UpsertTenantOutreachConfigDto`)

---

## 4.2 — GET inclui o campo

### O que fazer

Respostas de `get` / create / patch já devolvem o model Prisma — após schema, o campo aparece. Se houver DTO/swagger class que lista campos, incluir `coinDebitOnStatus`.

### Critérios de aceite

- [ ] GET platform e GET tenant retornam `coinDebitOnStatus`
- [ ] Default observado `delivered` em configs antigas migradas

### Não fazer

- Não omitir o campo por “interno”

---

## 4.3 — Postman, Swagger, FRONT-INTEGRATION

### O que fazer

Criar `FRONT-INTEGRATION.md` cobrindo:

- Campo, enum, default, ownership
- Comportamento runtime resumido (débito no status; failed estorna/reabre)
- Exemplos de PATCH/GET

Atualizar requests Postman de outreach config platform. Regenerar swagger se aplicável.

### Critérios de aceite

- [ ] FRONT-INTEGRATION.md existe nesta change
- [ ] Postman cobre PATCH com `coinDebitOnStatus`
- [ ] Swagger documenta o enum

### Não fazer

- Não implementar telas React

---

## Verificação do grupo

- Teste unitário `outreach-config.service.spec.ts` para patch platform do novo campo
- Chamada manual PATCH → GET

## Handoff para próxima task

Configurabilidade pronta para QA e backfill (gatilho efetivo por tenant no script).
