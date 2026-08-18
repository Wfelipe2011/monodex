## Why

O WebSocket (`realtime-inbox-websocket`) entrega `message.inbound` em tempo real apenas enquanto o PWA está aberto e conectado. Operadores que fecham o app ou deixam o dispositivo em background profundo (comum em iOS/Android) não recebem aviso de nova resposta do lead, perdendo tempo dentro da janela de 24h da Meta. Web Push com VAPID (já previsto no front) é o complemento natural para notificar com o app “fechado”.

## What Changes

- Modelo Prisma `PushSubscription` ligado a `User` (endpoint único, keys p256dh/auth).
- APIs autenticadas no **gym-ctrl** para registrar e remover subscriptions (`PUT`/`DELETE`).
- Serviço **web-push** no gym-ctrl com `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (par global único, não por tenant).
- Disparo push no mesmo fluxo do WebSocket: após `publishInbound`, enviar notificação para usuários elegíveis (tenant do evento + todos `SUPER_ADMIN`) que **não** tenham WebSocket OPEN no momento.
- Formato de notificação estilo conversa WhatsApp: **título** `Nova mensagem de {lead_name}`, **corpo** com prévia da mensagem (texto/botão truncado); **`tag`** por `leadId` para agrupar/atualizar a mesma “aba” de conversa no SO.
- Estender payload interno `message.inbound` com `leadName` (notifly já consulta `TenantListLead`).
- Rastrear `userId` nas conexões WebSocket para suprimir push duplicado quando o operador está online.
- Documentação `PUSH-INTEGRATION.md` para o front Next.js (Service Worker, subscribe, handlers) — sem código React neste repo.
- Tratamento de subscription expirada (HTTP 410) removendo registro.

**Fora de escopo:**

- Código Next.js / Service Worker neste monorepo.
- Push para outbound, statuses Meta ou inbound sem `listLeadId`.
- VAPID por tenant ou múltiplas origins.
- Redis / multi-instância.

## Capabilities

### New Capabilities

- `inbox-web-push`: registro de PushSubscription, envio VAPID, formato de notificação por lead, audiência tenant + super-admin, supressão quando WS online.

### Modified Capabilities

- `inbox-realtime-websocket`: payload interno inclui `leadName`; `publishInbound` também dispara web push para usuários offline (comportamento complementar ao fan-out WS existente).

## Impact

- **Prisma**: novo modelo `PushSubscription`; migration.
- **gym-ctrl**: `web-push` npm; env VAPID; módulo push; API subscriptions; extensão `InboxRealtimeGateway`/`Service` (userId); hook em `publishInbound`.
- **notifly**: incluir `leadName` no POST interno existente (campo opcional no DTO).
- **package.json**: dependência `web-push`.
- **Front externo**: SW + subscribe + POST subscription (documentado).
- Sem breaking change em APIs REST de conversa; DTO interno ganha campo opcional `leadName`.
