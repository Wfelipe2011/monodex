# Task 3 — Admin — WhatsApp accounts

**Change:** `whatsapp-tenant-phone-assignment`
**Grupo:** 3 de 8
**Pré-requisitos:** [task-01](./task-01-schema-e-migration.md)
**Desbloqueia:** [task-08](./task-08-seed-postman-e-verificacao.md)

## Objetivo do grupo

Super Admin cadastra N números no mesmo WABA, marca/promove default, e continua sem `tenantId` comercial nem token no body.

## Contexto para o subagent

- Controller: `apps/gym-ctrl/src/modules/admin/whatsapp-accounts.controller.ts` — `@Controller('platform/whatsapp-accounts')`, `SUPER_ADMIN`, `rejectSecretTokenFields`.
- Service: `apps/gym-ctrl/src/modules/admin/whatsapp-accounts.service.ts` — `list()` filtra `tenantId: null`; `create` força `tenantId: null`; `rejectNonNullTenantId` (400); `accountSelect` precisa ganhar `isDefault`.
- DTOs: `dto/create-whatsapp-account.dto.ts`, `dto/patch-whatsapp-account.dto.ts` — `wabaId` required no create; patch opcional; `tenantId` só null.
- Spec: contas plataforma, `isDefault`, WABA da frota, disable default → 400, promover na mesma transação.
- Não amarrar tenant aqui (isso é grupo 4 na outreach config).

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/gym-ctrl/src/modules/admin/whatsapp-accounts.service.ts` | editar |
| `apps/gym-ctrl/src/modules/admin/dto/create-whatsapp-account.dto.ts` | editar |
| `apps/gym-ctrl/src/modules/admin/dto/patch-whatsapp-account.dto.ts` | editar |
| `apps/gym-ctrl/src/modules/admin/whatsapp-accounts.controller.ts` | editar (summaries Swagger) |

---

## 3.1 — CRUD: vários números, mesmo WABA, `isDefault`

### O que fazer

- `accountSelect` inclui `isDefault`.
- `list()` continua `tenantId: null`, devolve **todas** as plataforma (não só default).
- Create:
  - `isDefault` opcional no DTO (`@IsBoolean` `@IsOptional`).
  - Se **não** existe default enabled: a nova conta **deve** nascer `isDefault: true` (mesmo se o body omitir / mandar false — primeira conta é default).
  - Se já existe default: nova conta `isDefault: false` a menos que o body peça `true` (aí aplica a regra de promoção do 3.2 na mesma transação).
  - `wabaId` deve ser igual ao `wabaId` da default atual quando a default existe; senão 400.
  - Unique `phoneNumberId`: Prisma P2002 → 400 amigável.
  - `tenantId` continua forçado null; body não-null → 400 (já existe).
- Patch:
  - Mesma checagem de `wabaId` divergente.
  - Continua recusando `tenantId` não null.

### Critérios de aceite

- [ ] POST segundo número mesmo `wabaId` → 201, `isDefault: false`, default anterior intacta
- [ ] POST `wabaId` diferente da default → 400
- [ ] POST `tenantId: 4` → 400
- [ ] GET list inclui `isDefault` em todos os itens
- [ ] Response nunca inclui access token

### Não fazer

- Não aceitar Meta token / `accessToken` (já há `rejectSecretTokenFields`)
- Não filtrar list só `isDefault: true`

---

## 3.2 — Promover default e travas

### O que fazer

Promoção (`PATCH { isDefault: true }` em B, A era default): transação Prisma:

1. `updateMany` / update A → `isDefault: false`
2. update B → `isDefault: true`

Recusar (400):

- `enabled: false` na conta que **é** default (antes ou depois do patch).
- `isDefault: true` em conta que tem `TenantOutreachConfig.whatsappAccountId` apontando para ela (precisa desamarrar no grupo 4 antes).
- `isDefault: false` na única default sem promover outra na mesma request — resultado seria zero defaults.

Se patch manda `isDefault: true` e `enabled: false` juntos → 400.

### Critérios de aceite

- [ ] Promover B: B default, A `isDefault` false; unique parcial não quebra
- [ ] Disable da default → 400, row continua enabled
- [ ] Promover conta amarrada a um tenant → 400

### Não fazer

- Não mover `WhatsappMessageTemplate` entre contas ao promover (risco documentado no design)

---

## Verificação do grupo

Swagger da tag `Platform — WhatsApp Accounts` mostra `isDefault`. Dois POSTs no mesmo WABA listam duas rows.

## Handoff para próxima task

Grupo 4 assume que existem ids de conta default e não-default. Grupo 7 synca na default.
