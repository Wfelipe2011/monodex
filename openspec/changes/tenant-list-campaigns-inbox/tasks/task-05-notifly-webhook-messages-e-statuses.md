# Task 5 — Notifly — webhook messages e statuses

**Change:** `tenant-list-campaigns-inbox`
**Grupo:** 5 de 8
**Pré-requisitos:** [task-01](./task-01-schema-e-migration.md)
**Desbloqueia:** [task-06](./task-06-notifly-cron-campanhas-e-reply-actions.md), [task-07](./task-07-admin-api-de-conversa.md)

## Objetivo do grupo

Webhook Meta persiste inbox e statuses de forma robusta; unlock em failed; base para reply handler.

## Contexto para o subagent

- Handler atual: `apps/notifly/src/notifly.controller.ts` — linhas 40–62
- Interfaces: `apps/notifly/src/interfaces.ts` — `Status`, `Message`
- Bug: `message['button'].text` sem `?.` quebra non-button messages
- Legado `prisma.message.create` — **substituir** por `WhatsappConversationMessage` para novos eventos; não remover tabela legado ainda
- Outreach cidade: `LeadsService.responseLeads` continua chamado para "Tenho Interesse!" — manter branch separada

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/notifly/src/notifly.controller.ts` | editar |
| `apps/notifly/src/webhook-persistence.service.ts` | criar |
| `apps/notifly/src/notifly.module.ts` | editar |

---

## 5.1 — Persistir inbound messages

### O que fazer

Criar `WebhookPersistenceService`:

```typescript
async handleInboundMessage(msg: Message, metadata: Metadata): Promise<void>
```

- Normalizar `phone` from `msg.from`
- Determinar `tenantId` / `listLeadId` / `listSendId`:
  - Se `msg.context?.id`: buscar `TenantListSend` por wamid → listLead, campaign, list, tenant
  - Senão: tentar `TenantLead.messageId` (cidade) — persistir mensagem com tenantId se achar; listLeadId null
  - Se nenhum: tenantId null ou skip tenant link (log warn)

- Insert `WhatsappConversationMessage`:
  - `wamid`: `msg.id`
  - `direction`: IN
  - `type`: `msg.type`
  - `body`: text body ou button text se aplicável
  - `raw`: msg JSON
  - Dedup: unique wamid — catch duplicate Meta retries

Refatorar controller:

```typescript
for (const entry of body.entry ?? []) {
  for (const change of entry.changes ?? []) {
    const value = change.value;
    for (const msg of value.messages ?? []) {
      await this.webhookPersistence.handleInboundMessage(msg, value.metadata);
      // branch outreach legado abaixo
    }
    for (const status of value.statuses ?? []) {
      await this.webhookPersistence.handleStatus(status);
    }
  }
}
```

Outreach legado: após persistir, se button/text "Tenho Interesse!" **e** correlacionado a `TenantLead` (não list send), chamar `leadsService.responseLeads`.

### Critérios de aceite

- [x] Inbound text não quebra quando não há button
- [x] Mensagem inbound aparece em `whatsapp_conversation_messages`

### Não fazer

- NOTIFY de lista (task 6)

---

## 5.2 — Persistir statuses e unlock

### O que fazer

```typescript
async handleStatus(status: Status): Promise<void>
```

- Insert `WhatsappSendStatus` row
- Buscar `TenantListSend` por `status.id` (wamid)
- Atualizar `TenantListSend.lastStatus`
- Se `status.status === 'failed'`:
  - `TenantListLead.sendLockCampaignId = null` where linked via send

Idempotência: Meta pode reenviar; append status rows OK.

### Critérios de aceite

- [x] Status delivered persiste
- [x] Failed clears send lock on list lead

### Não fazer

- Alterar cashback outreach

---

## Verificação do grupo

Simular POST webhook JSON com `messages` e `statuses` (fixture); verificar rows no DB.

## Handoff

Webhook grava inbox/status; task 6 adiciona reply actions para list sends.
