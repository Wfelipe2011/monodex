# Task 7 — Catálogo — sync na default

**Change:** `whatsapp-tenant-phone-assignment`
**Grupo:** 7 de 8
**Pré-requisitos:** [task-02](./task-02-resolver-de-credenciais.md)
**Desbloqueia:** [task-08](./task-08-seed-postman-e-verificacao.md)

## Objetivo do grupo

Sync Graph upserta templates **só** na conta `isDefault`. Test-send Super Admin pode escolher um `phoneNumberId` opcional.

## Contexto para o subagent

- Cron/sync notifly: `apps/notifly/src/whatsapp-template-sync.service.ts` — `syncFromGraph()` chama `resolveCredentials()` e upsert `whatsappAccountId: creds.accountId`. Sem tenant → após grupo 2 isso **já** é a default. Confirmar e **não** iterar todas as contas.
- Admin sync: `apps/gym-ctrl/src/modules/admin/whatsapp-templates.service.ts` ~linha 64 `resolveCredentials()` no sync; ~linha 208 no `testSend`.
- DTO teste: `apps/gym-ctrl/src/modules/admin/dto/test-whatsapp-template.dto.ts` — `to`, `variables?`, `leadId?`.
- Unique catalog: `(whatsappAccountId, name, language)`. Se syncasse cada número, duplicaria `test_gladson`.
- Grants e outreach FKs apontam para rows da conta que o seed/sync usou (default).

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/notifly/src/whatsapp-template-sync.service.ts` | editar se ainda não usa default-only |
| `apps/gym-ctrl/src/modules/admin/whatsapp-templates.service.ts` | editar |
| `apps/gym-ctrl/src/modules/admin/dto/test-whatsapp-template.dto.ts` | editar |

---

## 7.1 — Sync na default; test-send opcional por conta

### O que fazer

Sync admin e cron:

- `resolveCredentials()` **sem** tenant (default).
- Upsert somente `creds.accountId` da default.
- Comentário curto: números extras compartilham o catálogo do WABA; não copiar rows.

Test-send:

- DTO: `whatsappAccountId?: number` (`@IsOptional @IsInt @Min(1)`).
- Se presente: carregar a conta plataforma enabled e montar `messagesUrl` com o `phoneNumberId` dela + token do `tokenEnvKey` (pode reusar `resolveCredentials()` sem tenant só para token/waba, mas a URL **deve** ser do id pedido — mais limpo: buscar a conta por id e validar `tenantId==null`, `enabled`, mesmo `wabaId` da default).
- Se omitido: default (`resolveCredentials()`).
- Continua sem `TenantLead` / coin.
- Template lido do catálogo (ainda na default), não precisa existir row duplicada no segundo número.

### Critérios de aceite

- [ ] Com 2 contas no mesmo WABA, POST sync cria/atualiza templates só com `whatsappAccountId` = default.id
- [ ] Test-send sem `whatsappAccountId` POST Graph no default
- [ ] Test-send com `whatsappAccountId` do segundo número POST nesse `phoneNumberId`
- [ ] Test-send com id inexistente/disabled → 400 e não chama Graph

### Não fazer

- Não syncar `/{phoneNumberId}/message_templates` (o endpoint é do WABA)
- Não clonar catálogo por número

---

## Verificação do grupo

Dois números no banco, um sync, `SELECT whatsapp_account_id, name FROM whatsapp_message_templates` → só o id default.

## Handoff para próxima task

Seed continua upsertando templates na conta que marca `isDefault`. Postman adiciona `whatsappAccountId` opcional no test.
