## Context

Outreach oficial (`Lead` global + `TenantLead` + `contactLeads`) contacta leads do scrape por cidade. Super-admins precisam de um canal paralelo: listas de destinatários por tenant (cadastro/import), agendamentos de template Cloud API, débito de coins, resposta por botão e conversa de texto via Meta — tudo persistido para um front externo (polling, sem socket).

Hoje:
- `Message` / `WhatsapContact` guardam inbound parcial (só texto/botão em `body`, sem `wamid`, sem outbound).
- `POST /response-leads` ignora `value.statuses`, usa `message['button']` sem optional chaining, processa só `entry[0].changes[0]`.
- Catálogo + bindings + `buildTemplateSendBody` já existem (`@core/shared`); outreach de cidade permanece intocado.
- Frontend neste monorepo não existe; APIs `SUPER_ADMIN` no gym-ctrl; envio/cron no notifly.

## Goals / Non-Goals

**Goals:**

- Entidade irmã de `Lead` (`TenantListLead`) em listas por tenant, sem `cityId`/`rating`.
- Import de planilha com contrato fixo + download de exemplo; telefone único por lista.
- Múltiplos agendamentos (`TenantListCampaign`) por lista; lead bloqueado para outros templates após envio Graph 200, liberado se status `failed`.
- Bindings `recipient.*` + ações QUICK_REPLY (`NOTIFY` | `NOOP`); sem cashback.
- Duas stores: `WhatsappConversationMessage` (inbox) e `WhatsappSendStatus` (envelope).
- Webhook robusto: `messages` + `statuses`, correlacionar por `wamid` / `context.id`.
- API super-admin: CRUD listas/leads/campanhas, import, histórico, envio texto (janela 24h Meta).
- Cron notifly separado de `contactLeads`.

**Non-Goals:**

- Telas neste repo; WebSocket (polling no front).
- Permissões além de `SUPER_ADMIN`.
- Cashback; inbox unificado com `TenantLead` de cidade nesta change.
- Baileys; mídia além de texto/botão no MVP (image/audio armazenados como tipo + JSON cru).
- Criar templates na Meta; contas WABA por tenant.

## Decisions

### D1 — Modelos Prisma

**Escolha:**

```
TenantLeadList          tenantId, name, costPerSend, createdAt
TenantListLead          listId, name, phone (unique per list), website?, category?, reviews?
                        sendLockCampaignId? (nullable FK → campaign that claimed lead)
TenantListCampaign      listId, name, enabled, templateId, slotBindings JSON,
                        buttonActions JSON, notifyTemplateId?, notifySlotBindings JSON?,
                        schedule JSON (same shape as outreach), sendsPerRun, sendIntervalSeconds
TenantListSend          campaignId, listLeadId, wamid (unique), sentAt,
                        lastStatus (denormalized cache optional)
WhatsappConversationMessage
                        wamid (unique), direction IN|OUT, type, body?, raw Json,
                        phone, tenantId, listLeadId?, listSendId?, createdAt
WhatsappSendStatus      wamid, status enum, timestamp Meta, recipientId?, errors Json?,
                        listSendId?, tenantListLeadId? (for failed unlock)
```

**Por quê:** separar lead irmão do pool global; `TenantListSend` liga outbound template a status e inbox; lock no lead via `sendLockCampaignId` (null = elegível; set on 200; cleared on `failed`).

**Alternativa rejeitada:** reutilizar `Lead` com `cityId` fictício — polui outreach e unique `(phone, cityId)`.

### D2 — Contrato da planilha

Colunas (header case-insensitive, trim):

| Coluna | Obrigatório | Regra |
|--------|-------------|--------|
| `name` | sim | string não vazia |
| `phone` | sim | dígitos; normalizar `55` |
| `website` | não | URL ou vazio |
| `category` | não | string livre |
| `reviews` | não | inteiro ≥ 0 |

`GET /admin/tenants/:tenantId/lead-lists/:listId/import-template` retorna CSV (e opcionalmente XLSX) de exemplo.

Import: rejeitar duplicata de `phone` no arquivo e contra a lista; normalizar categoria com fold acento/minúsculas para sugestão, mas persistir texto original da planilha.

### D3 — Bindings de campanha

Estender enum em `@core/shared/whatsapp-template-bindings.ts`:

`recipient.name`, `recipient.phone`, `recipient.category`, `recipient.website`, `recipient.reviews` + existentes `literal`, `header_image`, `tenant.phone`, `now.*`.

Sem `recipient.city` / `recipient.rating`. Vazio → `—`.

Campanha guarda `slotBindings` sob chave `send` (espelho do padrão `outreach`/`notify`).

### D4 — Button actions

Extrair QUICK_REPLY labels do `components` JSON do template de disparo (não são slots hoje). `buttonActions` JSON:

```json
[
  { "buttonIndex": 0, "label": "Tenho Interesse!", "action": "NOTIFY" },
  { "buttonIndex": 1, "label": "Agora não", "action": "NOOP" }
]
```

Webhook inbound `type=button`: match `button.text` (trim, case-sensitive Meta) → se `NOTIFY`, POST notify template para `tenant.phone`; se `NOOP`, só persiste mensagem. Texto livre inbound: persiste inbox; **não** dispara notify (NOOP implícito).

URL buttons não são gatilho de reply action.

### D5 — Lock entre campanhas

- Antes do envio: lead elegível se `sendLockCampaignId IS NULL` **ou** último send dessa campanha tem status `failed`.
- Após Graph 200: set `sendLockCampaignId = campaignId`, create `TenantListSend` + outbound `WhatsappConversationMessage` + initial status row `sent` (when webhook arrives).
- Webhook `failed`: clear `sendLockCampaignId`, append `WhatsappSendStatus`.
- Lead **nunca** recebe segundo template de outra campanha enquanto lock ativo e último status ≠ `failed`.

Telefone único por lista impede duplicata na mesma base.

### D6 — Coins

Débito `costPerSend` da lista no sucesso Graph (mesmo padrão `contactLeads`: primeiro `User` do tenant). `CoinTransaction.leadId` permanece null; description referencia listLead/campaign. Sem cashback.

### D7 — Inbox vs status (stores separados)

- **Conversation:** uma linha por mensagem (in ou out), keyed by Meta `wamid`. Outbound gravado no POST Graph (template cron, notify, API texto). Inbound no webhook.
- **Status:** append-only por evento Meta (`sent`, `delivered`, `read`, `failed`); UI agrega por `wamid` / `TenantListSend`.

Legado `Message`/`WhatsapContact`: não expandir; novos fluxos usam modelos novos. Migração opcional de dados legados fora de escopo.

### D8 — Webhook handler (notifly)

Refatorar `NotiflyController.responseLeads`:

1. Iterar todas `entry[].changes[]`.
2. Se `messages`: persistir `WhatsappConversationMessage` IN; correlacionar `context.id` → `TenantListSend` / `TenantLead` (cidade só persiste mensagem, sem inbox API nesta change).
3. Se `statuses`: persistir `WhatsappSendStatus`; aplicar unlock em `failed`; atualizar cache em `TenantListSend`.
4. Botão mapeado → `ListCampaignReplyService` (notify/noop) para sends de lista.
5. Manter `responseLeads` existente para outreach cidade (hardcoded "Tenho Interesse!" intacto nesta change).

GET verify webhook permanece.

### D9 — API conversa (gym-ctrl)

```
GET  /admin/tenants/:tenantId/lead-lists/:listId/leads/:leadId/messages?since=<iso>
POST /admin/tenants/:tenantId/lead-lists/:listId/leads/:leadId/messages  { "text": "..." }
```

POST valida janela 24h: última inbound do phone após `now - 24h` (Meta rule). Fora da janela → 400 com código claro. Usa Cloud API `type: text` via `PlatformWhatsappAdminService`. Grava outbound message com `wamid` retornado.

Polling: front usa `since` timestamp; sem WebSocket.

### D10 — Cron campanhas

Novo `ListCampaignsService` no notifly, `@Cron(EVERY_HOUR)` espelhando `isWithinSchedule` do outreach:

- Campanhas `enabled` de tenants com saldo ≥ `costPerSend`.
- Seleciona leads elegíveis (lock rules), cap `sendsPerRun` e `floor(balance/costPerSend)`.
- `sendIntervalSeconds` entre envios.
- Não altera `LeadsService.contactLeads`.

### D11 — Admin routes (prefixo sugerido)

```
/admin/tenants/:tenantId/lead-lists                          CRUD list
/admin/tenants/:tenantId/lead-lists/:listId/leads            CRUD + bulk POST
/admin/tenants/:tenantId/lead-lists/:listId/import           multipart CSV
/admin/tenants/:tenantId/lead-lists/:listId/import-template  download exemplo
/admin/tenants/:tenantId/lead-lists/:listId/campaigns        CRUD campanhas
/admin/tenants/:tenantId/lead-lists/:listId/sends            list sends + statuses (failed filter)
GET .../category-suggestions                                 distinct categories (scrape + lists, normalized)
```

Todos `SUPER_ADMIN`.

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| Dois crons + webhook na mesma WABA → rate limit | `sendIntervalSeconds` por campanha; serializar envios no mesmo tick |
| Janela 24h expira → operador não envia texto | API retorna 400 explícito; front desabilita composer |
| QUICK_REPLY label muda na Meta | Validar labels contra `components` no enable da campanha |
| `findFirst` user para coin (legado) | Manter paridade com outreach; documentar |
| Webhook duplicado Meta | `wamid` unique em messages/status |

## Migration Plan

1. Migration Prisma (novos modelos; não alterar `Lead`).
2. Deploy gym-ctrl + notifly juntos (webhook + cron dependem dos modelos).
3. Seed opcional: lista demo vazia.
4. Rollback: desabilitar campanhas; webhook antigo pode coexistir se feature flag — preferir deploy atômico.

## Open Questions

- Formato de import além de CSV (XLSX) no MVP — CSV obrigatório; XLSX nice-to-have.
- Endpoint agregado de failed sends vs filtro query em `/sends?status=failed` — preferir query param.
