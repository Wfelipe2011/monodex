# Task 2 — Resolver de credenciais

**Change:** `whatsapp-tenant-phone-assignment`
**Grupo:** 2 de 8
**Pré-requisitos:** [task-01](./task-01-schema-e-migration.md)
**Desbloqueia:** [task-05](./task-05-notifly-envios-por-tenant.md), [task-06](./task-06-inbox-e-webhook.md), [task-07](./task-07-catalogo-sync-na-default.md)

## Objetivo do grupo

Um algoritmo de resolução nos dois apps: tenant com FK válida → esse número; senão → default; dedicado disabled **não** cai no default.

## Contexto para o subagent

Dois serviços **duplicados de propósito** (não extrair lib nesta change):

- `apps/notifly/src/platform-whatsapp.service.ts` — `resolveCredentials()` hoje: `findFirst` `tenantId: null, enabled: true, provider: CLOUD_API`. Graph `v23.0`. Token `process.env[tokenEnvKey]`. Throw `Error` se faltar conta/token.
- `apps/gym-ctrl/src/modules/admin/platform-whatsapp-admin.service.ts` — mesmo `findFirst`; throw `NotFoundException` / `BadRequestException`.

Chamadas atuais (ainda `resolveCredentials()` sem args — os grupos 5–7 trocam os call sites):

- notifly: `leads.service.ts`, `list-campaigns.service.ts`, `list-campaign-reply.service.ts`, `whatsapp-template-sync.service.ts`
- gym-ctrl: `list-conversations.service.ts`, `whatsapp-templates.service.ts`

Assinatura nova: `resolveCredentials(tenantId?: number)`. Call sites sem tenant (sync/test default) continuam compilando.

Runtime: Nest + Prisma. Não persistir token.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/notifly/src/platform-whatsapp.service.ts` | editar |
| `apps/gym-ctrl/src/modules/admin/platform-whatsapp-admin.service.ts` | editar |

---

## 2.1 — Notifly `resolveCredentials(tenantId?)`

### O que fazer

Substituir o `findFirst` cego. Pseudocódigo (espelhar no código, mensagens de erro em PT):

```
if tenantId != null:
  config = prisma.tenantOutreachConfig.findUnique({ where: { tenantId } })
  if config?.whatsappAccountId:
    account = prisma.whatsappAccount.findUnique({ where: { id: config.whatsappAccountId } })
    if !account || !account.enabled || account.provider != CLOUD_API:
      log error; throw (não buscar default)
    return creds(account)

account = prisma.whatsappAccount.findFirst({
  where: { isDefault: true, enabled: true, tenantId: null, provider: CLOUD_API }
})
if !account: throw
token = process.env[account.tokenEnvKey]
if !token: throw
messagesUrl = https://graph.facebook.com/v23.0/{phoneNumberId}/messages
return { accountId, wabaId, phoneNumberId, token, messagesUrl }
```

Manter o type `PlatformWhatsappCredentials` (já tem `accountId`).

### Critérios de aceite

- [ ] Sem `tenantId`: usa `isDefault: true`, nunca `findFirst` só por `enabled`
- [ ] Com tenant e FK apontando conta enabled: `phoneNumberId` dessa conta
- [ ] Com tenant e FK apontando conta `enabled=false`: throw, **sem** enviar URL da default
- [ ] Com tenant e FK null / sem config: default

### Não fazer

- Não alterar `leads.service` / campanhas nesta task (grupo 5)
- Não mover o serviço para `libs/`

---

## 2.2 — Gym-ctrl `PlatformWhatsappAdminService`

### O que fazer

Copiar o **mesmo** algoritmo. Manter exceptions HTTP (`NotFoundException` se não houver default; `BadRequestException` se token ausente). Para dedicado disabled: `BadRequestException` (ou `UnprocessableEntity`) com mensagem clara — o inbox (grupo 6) depende disso.

Helper opcional interno `credsFromAccount(account)` para não duplicar montagem de URL.

### Critérios de aceite

- [ ] Assinatura `resolveCredentials(tenantId?: number)`
- [ ] Mesmas regras de fallback / não-fallback do 2.1
- [ ] `GRAPH_API_VERSION` continua `v23.0`

### Não fazer

- Não mudar controllers nesta task

---

## Verificação do grupo

Grep: nenhum `findFirst` de `whatsappAccount` só com `tenantId: null, enabled: true` nesses dois arquivos. Compilação TypeScript dos dois apps.

## Handoff para próxima task

Grupos 3–4 podem seguir em paralelo (API). Grupos 5–7 passam `tenantId` nos call sites.
