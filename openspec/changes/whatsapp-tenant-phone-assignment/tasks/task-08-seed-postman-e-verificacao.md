# Task 8 — Seed, Postman e verificação

**Change:** `whatsapp-tenant-phone-assignment`
**Grupo:** 8 de 8
**Pré-requisitos:** [task-03](./task-03-admin-whatsapp-accounts.md), [task-04](./task-04-admin-amarracao-no-outreach-config.md), [task-05](./task-05-notifly-envios-por-tenant.md), [task-06](./task-06-inbox-e-webhook.md), [task-07](./task-07-catalogo-sync-na-default.md)
**Desbloqueia:** archive / implementação completa

## Objetivo do grupo

Seed idempotente com default; Postman cobre segundo número, amarração e 403; grep confirma que o FROM não é mais `findFirst` cego.

## Contexto para o subagent

- Seed: `prisma/seed-outreach.ts` — `upsertPlatformAccount()` busca `phoneNumberId: '1292251013966333'`, `tenantId: null`. Deve setar `isDefault: true` no create/update **dessa** row. Não criar segundo número no seed (Postman cria).
- Postman: `postman/monodex.postman_collection.json`
  - Pasta `Platform — WhatsApp Accounts` (~linha 550): List/Create/Get/Patch
  - Pasta `Platform — Outreach` (~linha 491): PATCH preço
  - Pasta tenant outreach (procurar `Tenant — Outreach`)
- Variáveis típicas: `gymBaseUrl`, `whatsappAccountId`, `tenantId`
- Specs da change em `openspec/changes/whatsapp-tenant-phone-assignment/specs/`
- FRONT-INTEGRATION.md nesta pasta: se ainda não existir, criar um curto só deste change (Super Admin escolhe o número; Admin só vê). **Não** usar a palavra “academia”. Tenant = cliente da plataforma.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `prisma/seed-outreach.ts` | editar |
| `postman/monodex.postman_collection.json` | editar |
| `openspec/changes/whatsapp-tenant-phone-assignment/FRONT-INTEGRATION.md` | criar se ausente |
| `openspec/changes/whatsapp-tenant-phone-assignment/NOTES.md` | opcional, só se houver desvio |

---

## 8.1 — Seed marca default

### O que fazer

Em `upsertPlatformAccount`:

- `create` e `update` incluem `isDefault: true` para a conta `PLATFORM_PHONE_NUMBER_ID`.
- Se outra row já for default (ambiente sujo), **não** ligar duas defaults: se a row alvo não for a default atual, ou bem promover esta (desmarcar a outra) ou só garantir que **esta** operacional continue default. Preferir: transação que desmarca outras `is_default` e marca esta — o seed é a conta canônica da plataforma.
- Não apagar outras `WhatsappAccount`.

### Critérios de aceite

- [ ] Rodar seed duas vezes: uma row `1292251013966333` com `isDefault: true`
- [ ] Unique parcial não quebra

### Não fazer

- Não inventar segundo `phoneNumberId` no seed

---

## 8.2 — Postman

### O que fazer

Na pasta WhatsApp Accounts:

- Create já manda `wabaId`; incluir `isDefault` opcional
- Novo: Create second number (mesmo `wabaId`, outro `phoneNumberId` placeholder)
- Novo: Patch promote default (e um request que tenta disable default — esperado 400)
- List deve mostrar `isDefault`

Na pasta Platform Outreach:

- PATCH `{ "whatsappAccountId": {{dedicatedWhatsappAccountId}} }`
- PATCH `{ "whatsappAccountId": null }`
- PATCH inválido: id da default (400)
- GET mostra `resolvedWhatsappAccount`

Tenant Outreach:

- PATCH Admin com `whatsappAccountId` (403)
- GET Admin inclui resolved só leitura

Templates:

- Test send body opcional `whatsappAccountId`

Variáveis de collection: `dedicatedWhatsappAccountId`.

### Critérios de aceite

- [ ] Requests novos existem e apontam `/platform/...` e `/tenant/...` corretos
- [ ] Nenhum request manda access token Meta

### Não fazer

- Não reescrever a collection inteira

---

## 8.3 — Validate e grep

### O que fazer

- `npx prisma validate`
- Grep nos apps (exceto testes se houver):

```
whatsappAccount.findFirst({
  where: { tenantId: null, enabled: true
```

Não deve restar esse padrão em `platform-whatsapp.service.ts` nem `platform-whatsapp-admin.service.ts`.

- Confirmar call sites de envio passam `tenantId` (leads, list-campaigns, list-campaign-reply, list-conversations).
- Sync **sem** tenant (default).

### Critérios de aceite

- [ ] `npx prisma validate` exit 0
- [ ] Resolver não usa `findFirst` só por `enabled` + `tenantId: null` sem `isDefault`
- [ ] Envios de tenant passam id

### Não fazer

- Não implementar frontend
- Não chamar Graph de verdade se o ambiente não tiver token (Postman/contrato basta)

---

## Verificação do grupo

Checklist da proposal: N números, 1 default, Super Admin amarra, Admin 403, sync sem duplicar.

## Handoff para próxima task

Change pronta para `/opsx-manager-apply` (já aplicada se este grupo rodou por último) ou archive.
