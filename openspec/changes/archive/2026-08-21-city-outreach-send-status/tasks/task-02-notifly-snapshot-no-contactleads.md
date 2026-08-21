# Task 2 — Notifly — snapshot no contactLeads

**Change:** `city-outreach-send-status`
**Grupo:** 2 de 5
**Pré-requisitos:** [task-01](./task-01-schema-e-migration.md)
**Desbloqueia:** [task-05](./task-05-postman-front-integration-e-verificacao.md)

## Objetivo do grupo

Todo envio Cloud API de cidade persiste o **nome do template** usado naquele POST. `lastStatus` não é `sent` só porque a Graph aceitou.

## Contexto para o subagent

- Arquivo: `apps/notifly/src/leads.service.ts`, método `contactLeads`.
- Create atual (~linhas 416–425):

```typescript
await tsx.tenantLead.create({
  data: {
    tenantId: tenant.id,
    leadId: lead.id,
    contacted: true,
    replied: false,
    deleted: false,
    messageId: res.data.messages[0].id,
  },
});
```

- O template já está em `outreachTemplate` (`config.outreachTemplate`), usado em `buildTemplateSendBody({ name: outreachTemplate.name, ... })`.
- Notify ao `Tenant.phone` em `responseLeads` (~linha 572) **não** entra nesta task (sem snapshot / sem wamid de notify).
- `apps/captura/src/leads.service.ts` cria `TenantLead` sem `messageId` — **não** alterar captura.
- Não há `leads.service.spec.ts`; se adicionar teste, mock Prisma + HTTP no estilo dos specs do notifly. Preferível um teste focado se o create for extraído; senão a verificação é inspeção do `create` + task 5.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/notifly/src/leads.service.ts` | editar |

---

## 2.1 — Snapshot de templateName

### O que fazer

No `tenantLead.create` de `contactLeads`, após Graph 200:

- `messageId`: `res.data.messages[0].id` (já existe)
- `templateName`: `outreachTemplate.name` (string do catálogo, não o id)
- **não** setar `lastStatus` (Prisma default null)

Não reler `TenantOutreachConfig` depois para “atualizar” o nome. Não gravar `outreachTemplateId` a menos que o schema da task 1 tenha só `templateName` (é só string).

Não mudar seleção de leads, coins, interval, bindings.

### Critérios de aceite

- [ ] `create` inclui `templateName: outreachTemplate.name`
- [ ] `lastStatus` omitido ou explicitamente null
- [ ] `responseLeads` notify **não** escreve `templateName`/`lastStatus` com o wamid do notify
- [ ] captura intocado

### Não fazer

- Não criar `TenantListSend` no outreach de cidade
- Não setar `lastStatus: 'sent'` no Graph 200
- Não snapshotar language nesta change

---

## Verificação do grupo

- Grep `tenantLead.create` em `leads.service.ts`: `templateName` presente no path Cloud API
- Grep `apps/captura`: create sem `templateName` obrigatório (continua válido — campos nullable)

## Handoff para próxima task

Novos envios já nascem com nome de template. Task 3 preenche status via webhook. Envios antigos ficam `templateName` null (esperado).
