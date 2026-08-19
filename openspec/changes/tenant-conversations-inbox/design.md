## Context

Inbox hoje é “mensagens de um `TenantListLead`”. O webhook persiste `IN` com `listLeadId` nulo quando a correlação é cidade ou número dedicado; o notify WS/push só dispara se `listLeadId` existir. Outreach de cidade grava `TenantLead.messageId` sem row de conversa. Test-send do catálogo não persiste mensagem. A API de reply vive em `/tenant/:tenantId/lead-lists/:listId/leads/:leadId/messages`.

Número dedicado (`WhatsappAccount.isDefault=false` + `TenantOutreachConfig.whatsappAccountId`) já resolve o FROM por tenant (`whatsapp-tenant-phone-assignment`). O default compartilhado não identifica tenant sem `context.wamid`.

Ops do tenant hoje: só `GET /tenant/:tenantId/leads/stats` (funil cidade) + coins em outro path. Super Admin já tem `GET /platform/ops/summary`.

Front não vive neste repo. Contrato: Swagger + Postman + `FRONT-INTEGRATION.md`.

## Goals / Non-Goals

**Goals:**

- Thread `(tenantId, phone)` como produto de conversa, independente de lista e de cidade.
- Gate: só número dedicado. Inbound/outbound nesse FROM upserta thread e histórico.
- Template visível no histórico: lista (disparo ao lead), cidade (`contactLeads`), test-send na conta dedicada amarrada.
- Inbound frio: `displayName` = `contacts[].profile.name` ou o número.
- Notify do operador = WS + web push (payload pela thread). Sem template ao `Tenant.phone` por inbound.
- **BREAKING:** API, WS e push deixam de usar `listId`/`leadId`. Front se adequa.
- Home do tenant: um GET com coins, funil cidade, `hasDedicatedNumber`, resumo de inbox, status de envios hoje e ontem (`America/Sao_Paulo`).
- Super Admin: GET de conversas e home; POST reply 403.

**Non-Goals:**

- Conversas no número default.
- Mídia: download da CDN Meta (continua `type` + `raw`).
- Super Admin respondendo.
- Template WhatsApp ao `Tenant.phone` quando chega inbound (notify de “Tenho Interesse!” / botão NOTIFY de lista permanece o que já é, **fora** da thread do lead).
- Telas neste repo; unread/`lastReadAt` (home usa janela 24h e `lastInboundAt`, não unread).
- Alterar listagem de sends de cidade ou de lista (home só agrega counts).

## Decisions

### D1 — Modelo `WhatsappConversation`; mensagem ganha `conversationId`

**Escolha:** Tabela `whatsapp_conversations` com `@@unique([tenantId, phone])`, `displayName`, `lastInboundAt`, `lastMessageAt`. `WhatsappConversationMessage.conversationId` obrigatório após backfill. `listLeadId` / `listSendId` continuam opcionais (proveniência), **não** são a identidade nem aparecem no contrato REST novo.

**Por quê:** Um telefone, uma thread. Lista e cidade podem originar o mesmo número sem duas inboxes.

**Alternativa rejeitada:** Lista sistema “Inbox” reusando `TenantListLead`. Mistura produtos. Terceiro path só para cidade deixa inbound frio órfão.

### D2 — Gate = conta dedicada amarrada ao tenant

**Escolha:** Upsert de thread + persistência de mensagem de conversa + WS/push **somente** se o FROM (`phone_number_id` inbound ou credencial resolvida no outbound) for `WhatsappAccount` com `isDefault=false` e `TenantOutreachConfig.whatsappAccountId` daquele tenant.

Default: comportamento atual de skip quando não há tenant (inbound sem context) / envios de lista/cidade **não** criam thread.

POST reply: 400 se o tenant não tiver número dedicado.

**Por quê:** Default é compartilhado; inbound sem `context` não tem tenant. O usuário restringiu o produto a esse gate.

**Alternativa rejeitada:** Thread também no default quando `context.wamid` aponta lista/cidade. Reabre roteamento no número compartilhado e contradiz o recorte.

### D3 — Helper de upsert compartilhado na prática, Prisma em cada app

**Escolha:** Função de domínio (normalizar telefone, resolver `displayName`) em `@core/shared` (ex. `whatsapp-conversation.ts`). `upsertConversationThenMessage` em notifly e gym-ctrl, cada um com `PrismaService`, mesma regra:

1. Recusar se não for dedicado do tenant.
2. `upsert` thread por `(tenantId, phone)`.
3. Se inbound trouxer `profile.name` não vazio, atualizar `displayName`.
4. Insert da mensagem com `conversationId`.
5. Atualizar `lastMessageAt`; se `IN`, `lastInboundAt`.

**Por quê:** Os dois apps já falam Prisma; não inventar um serviço HTTP interno só para isso.

### D4 — Fontes de `OUT` template na thread

| Origem | Entra na thread? |
|--------|------------------|
| Cron campanha de lista → **lead** | Sim, se dedicado |
| `contactLeads` cidade → **lead** | Sim, se dedicado |
| `POST .../whatsapp-templates/:id/test` com `whatsappAccountId` dedicado amarrado | Sim, tenant da config |
| Reply texto `POST .../conversations/:id/messages` | Sim |
| Notify lista / cidade para **`Tenant.phone`** | **Não** (não é conversa com o lead) |

`displayName` no create da thread por outbound: nome do list lead ou `Lead.name` se o telefone bater nesse tenant; senão o número. Inbound depois pode promover para `profile.name`.

Test-send no default ou em número não amarrado: igual hoje (Graph only, sem thread, sem coins, sem `TenantLead`).

### D5 — `displayName` no inbound frio

**Escolha:** `handleInboundMessage` recebe `contacts` do webhook (`ChangeValue.contacts`). Match `contacts[].wa_id` com `msg.from` (normalizados). Nome = `profile.name` trimado se não vazio; senão o telefone normalizado (o mesmo gravado em `phone`).

Thread já existente: se vier `profile.name`, sobrescreve `displayName`; se não vier, mantém o snapshot.

**Por quê:** Pedido explícito; Meta manda o nome no array `contacts`, não no objeto `messages[]`.

### D6 — APIs novas; lista de mensagens some

**Escolha:**

| Método | Path | Papel |
|--------|------|--------|
| GET | `/tenant/:tenantId/conversations` | Admin + Super Admin. Threads `lastMessageAt` desc. |
| GET | `/tenant/:tenantId/conversations/:conversationId/messages` | Idem. `since` ISO opcional, `createdAt` asc. |
| POST | `/tenant/:tenantId/conversations/:conversationId/messages` | **Só Admin.** `{ text }`. Janela 24h no último `IN` da thread. 400 `OUTSIDE_MESSAGING_WINDOW`. Graph via `resolveCredentials(tenantId)`. |

Remover `ListConversationsController` (`.../lead-lists/.../leads/:leadId/messages`). Postman e Swagger migram.

Lista de threads (item): `id`, `phone`, `displayName`, `lastMessageAt`, `lastInboundAt`, `windowOpen` (inbound < 24h), `lastMessage` resumido.

**Por quê:** Front se adequa; conversa deixa de parecer sub-recurso de lista.

**Alternativa rejeitada:** Dual-write nos dois paths. O usuário pediu migrar tudo.

### D7 — WS e push pela thread (**BREAKING**)

**Escolha:** Evento e notify interno:

```json
{
  "type": "message.inbound",
  "tenantId": 4,
  "conversationId": 88,
  "displayName": "Maria",
  "message": {
    "id": 1,
    "wamid": "wamid.xxx",
    "direction": "IN",
    "type": "text",
    "body": "oi",
    "phone": "5511999998888",
    "createdAt": "2026-08-19T12:00:00.000Z"
  }
}
```

Notifly chama notify quando persistiu `IN` **com** `conversationId` (dedicado). Não exige `listLeadId`.

Push: `tag` = `inbox-conversation-{conversationId}`; `data.url` = `/tenant/{tenantId}/conversations/{conversationId}`.

Path WS `ws/inbox` e rooms `tenant:{id}` / `super-admin` **não mudam**.

### D8 — Home `GET /tenant/:tenantId/ops/home`

**Escolha:** Um GET no controller tenant de ops (mesmo guards: `TenantScopeGuard` + `TenantActiveGuard`, roles Admin + Super Admin). Sem espelho `/platform/ops/...` novo.

Timezone dos dias: `America/Sao_Paulo`. `today` = `[início do dia local, início de amanhã)`; `yesterday` o intervalo anterior.

`sends`: união de envios Cloud do tenant naquele intervalo:

- `TenantListSend.sentAt` cujo `campaign.list.tenantId` = tenant
- `TenantLead.createdAt` com `messageId` não nulo (envio cidade; captura sem wamid fora)

Contar por `lastStatus`: `sent`, `delivered`, `read`, `failed`, `pending` (`lastStatus` null), mais `total`. Um wamid não entra nas duas tabelas.

Shape:

```json
{
  "coins": { "balance": 12.5 },
  "outreach": {
    "enabled": true,
    "hasDedicatedNumber": true,
    "cityFunnel": { "contacted": 12, "replied": 4, "quoted": 1, "closed": 0, "deleted": 2 }
  },
  "inbox": {
    "threadCount": 10,
    "openWindows": 3,
    "lastInboundAt": "2026-08-19T11:00:00.000Z"
  },
  "sends": {
    "timezone": "America/Sao_Paulo",
    "today": { "sent": 1, "delivered": 4, "read": 2, "failed": 0, "pending": 1, "total": 8 },
    "yesterday": { "sent": 0, "delivered": 2, "read": 5, "failed": 1, "pending": 0, "total": 8 }
  }
}
```

`coins.balance`: soma de `Coin.balance` do tenant. `hasDedicatedNumber`: config com `whatsappAccountId` de conta `isDefault=false`. `openWindows`: threads com `lastInboundAt >= now-24h`. Sem número dedicado, `inbox` ainda pode vir zerado/histórico; o front usa a flag para esconder a inbox.

Funil cidade reutiliza a agregação de `leadsStats` (não duplicar regra).

### D9 — Correlação inbound

Ordem em `resolveCorrelation` (estender, não jogar fora):

1. `context.id` → `TenantListSend` (tenant + phone do lead; thread por phone).
2. `context.id` → `TenantLead.messageId` (tenant + phone do `Lead`).
3. `metadata.phone_number_id` dedicado amarrado → tenant, phone = `msg.from` (frio ou reply sem quote).
4. Senão: não persiste conversa (igual “unknown” hoje).

Passos 1–2 **só** upsertam thread se o `phone_number_id` do webhook for o dedicado daquele tenant (D2). Context de lista no default **não** abre inbox.

Após persistir `IN` de cidade com context, manter o update de funil `replied=true` que `responseLeads` já faz — fora da thread, mas não quebrar.

## Risks / Trade-offs

- [Tenants só no default perdem inbox de lista] → Mitigação: produto explícito; home `hasDedicatedNumber`; Super Admin amarra número antes de vender conversa.
- [Breaking WS/push/REST] → Mitigação: um `FRONT-INTEGRATION.md` único; Postman substitui requests antigos; não dual-write.
- [Notify `Tenant.phone` vs thread] → Mitigação: D4 exclui esse FROM/TO da upsert.
- [Dois apps upsertam a mesma unique] → Mitigação: `@@unique([tenantId, phone])` + Prisma upsert; wamid unique na mensagem (P2002 inbound duplicado continua ignore).
- [Home “hoje” em UTC mentiria] → Mitigação: D8 `America/Sao_Paulo`.
- [Backfill de threads sem `displayName` de perfil] → Mitigação: backfill usa `TenantListLead.name` se `listLeadId`, senão `phone`.

## Migration Plan

1. Migration: criar `whatsapp_conversations`; `conversation_id` nullable em `whatsapp_conversation_messages`.
2. Backfill: `INSERT` distinct `(tenant_id, phone)`; `display_name` do list lead ou phone; `last_message_at` / `last_inbound_at` dos max.
3. Update `conversation_id`; `SET NOT NULL` + FK + índice `(conversation_id, created_at)`.
4. Deploy gym-ctrl + notifly juntos (payload interno breaking).
5. Front corta paths antigos no mesmo release.
6. Rollback: migration down + revert código; mensagens antigas com `listLeadId` permanecem.

## Open Questions

Nenhum bloqueante. Assumido: timezone `America/Sao_Paulo`; sem unread; notify ao `Tenant.phone` fora da thread.
