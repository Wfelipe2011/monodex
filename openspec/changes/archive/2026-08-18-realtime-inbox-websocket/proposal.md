## Why

O inbox de conversas de listas (`WhatsappConversationMessage`) já expõe histórico via REST com polling (`?since=`), mas o front PWA (Next.js na Vercel) não recebe aviso imediato quando o lead responde no WhatsApp. Operadores dependem de refresh manual ou poll interval, o que atrasa resposta dentro da janela de 24h da Meta. Com webhook inbound persistindo em `notifly` e API admin em `gym-ctrl`, falta um canal push server→client para atualizar a UI em tempo real.

## What Changes

- WebSocket no **gym-ctrl** (processo long-running): conexão autenticada por JWT, rooms por `tenantId` e room global `super-admin`.
- Evento `message.inbound` emitido **somente** após persistência de mensagem `direction=IN` correlacionada a lead de lista (`listLeadId` presente).
- Endpoint HTTP interno no gym-ctrl para fan-out, chamado pelo **notifly** após `WebhookPersistenceService.handleInboundMessage` com sucesso.
- Payload enxuto com `tenantId`, `listId`, `leadId` e preview da mensagem; polling REST permanece como fallback/reconexão.
- Variáveis de ambiente: secret compartilhado notifly→gym-ctrl, URL base do gym-ctrl no notifly.
- Documentação de contrato do evento para integração do front externo.

**Fora de escopo nesta change:**

- Web Push / VAPID (app fechado).
- Notificação de outbound, statuses Meta ou mensagens de outreach cidade sem `listLeadId`.
- Redis / multi-instância (PRD assume 1 instância).
- Telas ou código Next.js neste monorepo.
- Abrir API REST de conversa para roles além de `SUPER_ADMIN` (WS já prepara rooms por tenant para quando o front tenant existir).

## Capabilities

### New Capabilities

- `inbox-realtime-websocket`: gateway WebSocket autenticado, rooms por tenant e super-admin, contrato de evento `message.inbound`, fan-out in-memory e endpoint interno de notify.

### Modified Capabilities

- `whatsapp-conversation-inbox`: complementar polling REST com entrega realtime de inbound para clientes conectados (sem remover nem alterar contrato GET/POST existente).

## Impact

- **gym-ctrl**: `@nestjs/websockets`, `@nestjs/platform-ws`, `ws`; novo módulo/gateway; adapter WS em `main.ts`; endpoint interno; validação Joi de novas env vars.
- **notifly**: serviço HTTP para notificar gym-ctrl após inbound persistido; novas env vars.
- **package.json** (root): dependências WebSocket.
- **Front externo** (fora do repo): conectar em `wss://<gym-ctrl>/ws/inbox?token=<jwt>`; handler de `message.inbound`.
- Sem migration Prisma; sem breaking change em APIs REST existentes.
