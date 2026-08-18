# Task 1 — Schema e migration

**Change:** `tenant-list-campaigns-inbox`
**Grupo:** 1 de 8
**Pré-requisitos:** nenhum
**Desbloqueia:** [task-02](./task-02-shared-recipient-bindings-e-helpers.md), [task-03](./task-03-admin-listas-e-leads.md)

## Objetivo do grupo

Modelos Prisma e migration para listas, leads irmãos, campanhas, sends, inbox e status — base de dados pronta para APIs e notifly.

## Contexto para o subagent

- Schema atual: `prisma/schema.prisma` — `Lead` exige `cityId`; **não** reutilizar para listas.
- Padrão de nomes: `@map` snake_case, `@@map` plural.
- `CoinTransaction.leadId` já é opcional — débitos de lista podem omitir FK global.
- Legado `Message` / `WhatsapContact` permanece; novos fluxos usam tabelas novas.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `prisma/schema.prisma` | editar |
| `prisma/migrations/*` | criar (via `npx prisma migrate dev`) |

---

## 1.1 — Modelos e migration

### O que fazer

Adicionar ao `schema.prisma`:

**Enums**
- `WhatsappMessageDirection`: `IN`, `OUT` (ou reutilizar `MessageDirection` se compatível — preferir enum dedicado `WhatsappConversationDirection` para não confundir com legado)
- `WhatsappDeliveryStatus`: `sent`, `delivered`, `read`, `failed`
- `ListCampaignButtonAction`: `NOTIFY`, `NOOP`

**Models (nomes sugeridos — ajustar se conflitar)**

```prisma
model TenantLeadList {
  id           Int      @id @default(autoincrement())
  tenantId     Int      @map("tenant_id")
  tenant       Tenant   @relation(...)
  name         String
  costPerSend  Float    @map("cost_per_send")
  leads        TenantListLead[]
  campaigns    TenantListCampaign[]
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")
  @@map("tenant_lead_lists")
}

model TenantListLead {
  id                 Int       @id @default(autoincrement())
  listId             Int       @map("list_id")
  list               TenantLeadList @relation(...)
  name               String
  phone              String
  website            String?
  category           String?
  reviews            Int?
  sendLockCampaignId Int?      @map("send_lock_campaign_id")
  sendLockCampaign   TenantListCampaign? @relation("SendLock", ...)
  sends              TenantListSend[]
  createdAt          DateTime  @default(now()) @map("created_at")
  updatedAt          DateTime  @updatedAt @map("updated_at")
  @@unique([listId, phone])
  @@map("tenant_list_leads")
}

model TenantListCampaign {
  id                  Int      @id @default(autoincrement())
  listId              Int      @map("list_id")
  list                TenantLeadList @relation(...)
  name                String
  enabled             Boolean  @default(false)
  templateId          Int      @map("template_id")
  template            WhatsappMessageTemplate @relation(...)
  slotBindings        Json     @default("{}") @map("slot_bindings")
  notifyTemplateId    Int?     @map("notify_template_id")
  notifyTemplate      WhatsappMessageTemplate? @relation(...)
  notifySlotBindings  Json     @default("{}") @map("notify_slot_bindings")
  buttonActions       Json     @default("[]") @map("button_actions")
  schedule            Json
  sendsPerRun         Int      @default(5) @map("sends_per_run")
  sendIntervalSeconds Int      @default(5) @map("send_interval_seconds")
  sends               TenantListSend[]
  lockedLeads         TenantListLead[] @relation("SendLock")
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")
  @@map("tenant_list_campaigns")
}

model TenantListSend {
  id          Int      @id @default(autoincrement())
  campaignId  Int      @map("campaign_id")
  campaign    TenantListCampaign @relation(...)
  listLeadId  Int      @map("list_lead_id")
  listLead    TenantListLead @relation(...)
  wamid       String   @unique
  sentAt      DateTime @default(now()) @map("sent_at")
  lastStatus  WhatsappDeliveryStatus? @map("last_status")
  statuses    WhatsappSendStatus[]
  @@map("tenant_list_sends")
}

model WhatsappConversationMessage {
  id          Int      @id @default(autoincrement())
  wamid       String   @unique
  direction   WhatsappConversationDirection
  type        String
  body        String?
  raw         Json
  phone       String
  tenantId    Int      @map("tenant_id")
  tenant      Tenant   @relation(...)
  listLeadId  Int?     @map("list_lead_id")
  listLead    TenantListLead? @relation(...)
  listSendId  Int?     @map("list_send_id")
  listSend    TenantListSend? @relation(...)
  createdAt   DateTime @default(now()) @map("created_at")
  @@index([listLeadId, createdAt])
  @@map("whatsapp_conversation_messages")
}

model WhatsappSendStatus {
  id           Int      @id @default(autoincrement())
  wamid        String
  status       WhatsappDeliveryStatus
  metaTimestamp DateTime @map("meta_timestamp")
  recipientId  String?  @map("recipient_id")
  errors       Json?
  listSendId   Int?     @map("list_send_id")
  listSend     TenantListSend? @relation(...)
  createdAt    DateTime @default(now()) @map("created_at")
  @@index([wamid, metaTimestamp])
  @@map("whatsapp_send_statuses")
}
```

Adicionar relações inversas em `Tenant` e `WhatsappMessageTemplate` conforme necessário.

Rodar migration e `npx prisma generate`.

### Critérios de aceite

- [ ] Migration aplica sem erro em DB local
- [ ] `@@unique([listId, phone])` em `TenantListLead`
- [ ] `wamid` unique em `WhatsappConversationMessage` e `TenantListSend`

### Não fazer

- Alterar modelo `Lead` ou `TenantLead`
- Migrar dados de `Message` legado

---

## Verificação do grupo

```bash
npx prisma validate
npx prisma migrate dev --name tenant_list_campaigns_inbox
```

## Handoff para próxima task

Prisma Client exporta novos tipos; shared e admin podem importar `@prisma/client`.
