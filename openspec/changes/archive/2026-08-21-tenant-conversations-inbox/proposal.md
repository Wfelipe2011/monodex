## Why

Conversas na plataforma hoje só existem se o webhook achar um lead de lista. Resposta a template de cidade, inbound frio no número dedicado e teste de catálogo ou não notificam ou não têm API. O produto de conversa precisa ser do tenant e do telefone, não de lista nem de outreach de cidade — e o Admin precisa de um Início com números do dia, não só o funil de cidade.

## What Changes

- Thread de conversa com identidade `(tenantId, phone)`, produto **à parte** de listas e de outreach de cidade.
- **BREAKING:** inbox só no `phoneNumberId` dedicado (`isDefault=false`) amarrado ao tenant. Número default compartilhado não cria thread nem dispara WS/push.
- Inbound no dedicado: upsert da thread, grava `IN`, notifica Admin via **WebSocket + web push** (não envia template ao `Tenant.phone`).
- Inbound frio: `displayName` = `contacts[].profile.name` do webhook se houver; senão o próprio número.
- Template `OUT` no histórico quando o Graph aceitar e o FROM for o número dedicado: campanha de lista, outreach de cidade, notify de botão de lista, e test-send do catálogo nesse número.
- **BREAKING:** `GET/POST /tenant/:tenantId/lead-lists/:listId/leads/:leadId/messages` sai. Front passa a `GET /tenant/:tenantId/conversations` e `GET/POST /tenant/:tenantId/conversations/:conversationId/messages`.
- Admin responde texto livre na janela Meta 24h. Super Admin **só lê** (POST 403).
- `GET /tenant/:tenantId/ops/home`: catado para a tela de Início do tenant (coins, funil cidade, flag de número dedicado, resumo de inbox, status de envios **hoje** e **ontem**). Super Admin já tem `GET /platform/ops/summary`; home é do tenant.

## Capabilities

### New Capabilities

- `tenant-home-ops`: GET agregado de Início para `ADMIN` do tenant (e Super Admin em modo leitura no mesmo path), incluindo status de envios do dia atual e do anterior.

### Modified Capabilities

- `whatsapp-conversation-inbox`: identidade da thread por `(tenantId, phone)`; APIs novas; gate do número dedicado; templates de qualquer origem no histórico; inbound frio; remoção da API amarrada a lista.
- `inbox-realtime-websocket`: `message.inbound` passa a carregar `conversationId` + `displayName` (não `listId`/`leadId`).
- `inbox-web-push`: deep link e `tag` pela thread (`/tenant/{tenantId}/conversations/{conversationId}`).
- `cloud-outreach-runtime`: após Graph 200 de cidade, se o tenant tiver número dedicado, upsert da thread e mensagem `OUT` tipo template.
- `whatsapp-template-catalog`: test-send em conta dedicada amarrada a um tenant persiste thread + `OUT`; continua sem `TenantLead` e sem coins.

## Impact

- **Prisma:** modelo `WhatsappConversation`; `conversationId` em `WhatsappConversationMessage`; backfill por `(tenantId, phone)`.
- **notifly:** webhook correlaciona pelo dedicado; passa `contacts` para o nome; notify interno só com thread; `contactLeads` e campanhas de lista gravam `OUT` na thread.
- **gym-ctrl:** novo módulo/API de conversas; remove controller de mensagens de lista; home em ops; test-send grava conversa quando dedicado; WS/push contratam o novo payload.
- **Front:** breaking em REST de mensagens, evento WS e URL da push. Postman + `FRONT-INTEGRATION.md`. Sem telas neste repo.
- **Fora:** conversas no número default; mídia rica (CDN); Super Admin respondendo; template WhatsApp ao `Tenant.phone` por inbound; misturar com `city-outreach-send-status`.
