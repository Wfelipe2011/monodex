# Task 5 — Notifly — envios por tenant

**Change:** `whatsapp-tenant-phone-assignment`
**Grupo:** 5 de 8
**Pré-requisitos:** [task-02](./task-02-resolver-de-credenciais.md)
**Desbloqueia:** [task-08](./task-08-seed-postman-e-verificacao.md)

## Objetivo do grupo

Outreach de cidade, notify de reply e campanhas de lista POSTAM Graph no `phoneNumberId` resolvido daquele tenant.

## Contexto para o subagent

Após o grupo 2, `PlatformWhatsappService.resolveCredentials(tenantId?: number)` já existe. Call sites ainda chamam sem argumento.

Arquivos:

- `apps/notifly/src/leads.service.ts`
  - `contactLeads`: ~linha 375 `resolveCredentials()` uma vez por tenant no loop de envio
  - `responseLeads` / notify ao tenant: ~linha 558 outro `resolveCredentials()`; `to` continua `Tenant.phone` (não mudar o destino)
- `apps/notifly/src/list-campaigns.service.ts` ~linha 141 — `runCampaign` já tem `tenant` no contexto
- `apps/notifly/src/list-campaign-reply.service.ts` ~linha 140 — `handleNotify`; `tenant` vem de `campaign.list.tenant`

Não mudar seleção de leads, coins, bindings, templates.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/notifly/src/leads.service.ts` | editar |
| `apps/notifly/src/list-campaigns.service.ts` | editar |
| `apps/notifly/src/list-campaign-reply.service.ts` | editar |

---

## 5.1 — `contactLeads` e notify de reply

### O que fazer

Passar `tenant.id` (número) para `resolveCredentials`. Se o método receber o objeto tenant, usar `.id`.

Há dois pontos em `leads.service.ts` — os dois precisam do id do tenant daquele envio, não da default global.

Se resolver throw (dedicado disabled), o run daquele tenant falha com log; **não** capturar para reenviar na default.

### Critérios de aceite

- [ ] Grep em `leads.service.ts`: toda chamada `resolveCredentials` inclui o tenant id
- [ ] Notify continua `to: Tenant.phone`; só a URL Graph muda com o FROM

### Não fazer

- Não alterar `WhatsappController` welcome (`Tenant.phone` / `wa.me`)
- Não alterar captura/Baileys

---

## 5.2 — Campanhas e notify de botão

### O que fazer

`list-campaigns.service.ts`: `resolveCredentials(tenant.id)` no `runCampaign` (o `tenant` já está no closure).

`list-campaign-reply.service.ts`: `resolveCredentials(tenant.id)` em `handleNotify`.

Se houver outros `resolveCredentials()` no app notifly além de sync (grupo 7), passar tenant quando o fluxo for de um tenant.

### Critérios de aceite

- [ ] Campanha de tenant dedicado usa `phoneNumberId` da conta A
- [ ] Notify de QUICK_REPLY idem
- [ ] Tenant com FK null usa default

### Não fazer

- Não aplicar `TenantSendPolicy` em campanhas de lista (já fora)

---

## Verificação do grupo

Grep `resolveCredentials()` sem args em `leads.service.ts`, `list-campaigns.service.ts`, `list-campaign-reply.service.ts` → zero matches.

## Handoff para próxima task

Inbox/webhook (6) e sync (7) são os últimos call sites. Seed/Postman (8) exercitam o caminho feliz.
