# Task 1 — Schema e migration

**Change:** `tenant-conversations-inbox`
**Grupo:** 1 de 7
**Pré-requisitos:** nenhum
**Desbloqueia:** [task-02](./task-02-shared-telefone-nome-e-gate-dedicado.md), [task-03](./task-03-notifly-thread-no-webhook-e-nos-templates.md), [task-04](./task-04-admin-api-de-conversas.md), [task-05](./task-05-admin-websocket-e-web-push.md), [task-06](./task-06-admin-test-send-e-home-do-tenant.md)

## Objetivo do grupo

Criar a thread `WhatsappConversation` `(tenantId, phone)` e amarrar mensagens existentes via backfill. Sem lógica de app.

## Contexto para o subagent

- Schema: `prisma/schema.prisma`.
- `Tenant` (~linha 11) já tem `whatsappConversationMessages WhatsappConversationMessage[]`. Adicionar `whatsappConversations WhatsappConversation[]`.
- `WhatsappConversationMessage` (~linha 550): `listLeadId` / `listSendId` **permanecem** opcionais (proveniência). Identidade nova = `conversationId`.
- Telefone nas mensagens já é normalizado (`normalizeListPhone` → dígitos com prefixo `55`). Backfill agrupa por `tenant_id` + `phone` **como está gravado**.
- `display_name` no backfill: se a mensagem mais recente do grupo tiver `list_lead_id`, usar `tenant_list_leads.name`; senão o próprio `phone`.
- `last_message_at` = `MAX(created_at)` do grupo; `last_inbound_at` = `MAX(created_at)` onde `direction = 'IN'` (enum Prisma `WhatsappConversationDirection`).
- Migrations em `prisma/migrations/`. Nome: `tenant_conversations_inbox`.
- Não alterar apps nesta task.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `prisma/schema.prisma` | editar |
| `prisma/migrations/<timestamp>_tenant_conversations_inbox/migration.sql` | criar |

---

## 1.1 — Modelo Prisma e FK

### O que fazer

Adicionar:

```prisma
model WhatsappConversation {
  id            Int      @id @default(autoincrement())
  tenantId      Int      @map("tenant_id")
  tenant        Tenant   @relation(fields: [tenantId], references: [id])
  phone         String
  displayName   String   @map("display_name")
  lastInboundAt DateTime? @map("last_inbound_at")
  lastMessageAt DateTime  @map("last_message_at")
  messages      WhatsappConversationMessage[]
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  @@unique([tenantId, phone])
  @@index([tenantId, lastMessageAt])
  @@map("whatsapp_conversations")
}
```

Em `WhatsappConversationMessage` adicionar `conversationId` / `conversation` (obrigatório **depois** do backfill) e `@@index([conversationId, createdAt])`. Manter `@@index([listLeadId, createdAt])` e `wamid` unique.

### Critérios de aceite

- [ ] `@@unique([tenantId, phone])` na thread
- [ ] `listLeadId` e `listSendId` continuam opcionais
- [ ] `npx prisma validate` passa

### Não fazer

- Não dropar `listLeadId` / `listSendId`
- Não adicionar `tenantLeadId` na mensagem (cidade entra na thread pelo telefone)
- Não criar `lastReadAt` / unread

---

## 1.2 — Migration e backfill

### O que fazer

Gerar migration (`npx prisma migrate dev --name tenant_conversations_inbox` ou SQL no padrão existente) com:

1. `CREATE TABLE whatsapp_conversations` (cols mapeadas snake_case).
2. `ALTER TABLE whatsapp_conversation_messages ADD COLUMN conversation_id INTEGER` **nullable**.
3. Backfill: inserir uma conversation por par distinto `(tenant_id, phone)` das mensagens; preencher `display_name`, `last_message_at`, `last_inbound_at`.
4. `UPDATE` `conversation_id` nas mensagens.
5. `SET NOT NULL` em `conversation_id` + FK + índice `(conversation_id, created_at)`.
6. Unique `(tenant_id, phone)` e índice `(tenant_id, last_message_at)`.

Se a tabela de mensagens estiver vazia, o NOT NULL ainda vale (0 rows).

Rodar generate do client Prisma.

### Critérios de aceite

- [ ] SQL de backfill não inventa threads sem mensagens
- [ ] Após migrate, `conversation_id` é NOT NULL
- [ ] Client Prisma gerado inclui `WhatsappConversation`

### Não fazer

- Não apagar rows de `whatsapp_conversation_messages`
- Não mexer em `TenantLead` / `TenantListSend`

---

## Verificação do grupo

```
npx prisma validate
```

## Handoff para próxima task

Modelo pronto para upsert `(tenantId, phone)` e create de mensagem com `conversationId`. Apps ainda não compilam contra o client novo até o generate; task 2 não depende do client.
