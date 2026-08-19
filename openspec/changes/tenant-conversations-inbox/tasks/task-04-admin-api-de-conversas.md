# Task 4 — Admin — API de conversas

**Change:** `tenant-conversations-inbox`
**Grupo:** 4 de 7
**Pré-requisitos:** [task-01](./task-01-schema-e-migration.md), [task-02](./task-02-shared-telefone-nome-e-gate-dedicado.md)
**Desbloqueia:** [task-07](./task-07-postman-front-integration-e-verificacao.md)

## Objetivo do grupo

REST de inbox no produto thread. Remover o controller aninhado em lista. Super Admin só lê; reply exige número dedicado e janela 24h.

## Contexto para o subagent

- Hoje: `apps/gym-ctrl/src/modules/admin/list-conversations.controller.ts` path `tenant/:tenantId/lead-lists/:listId/leads/:leadId/messages`.
- Service: `list-conversations.service.ts` — janela 24h via `findFirst` IN; Graph `platformWhatsapp.resolveCredentials(tenantId)`; persist OUT; 400 `OUTSIDE_MESSAGING_WINDOW`; trim + max 4096.
- Spec: `list-conversations.service.spec.ts` (FROM dedicado vs default).
- Guards: `RolesAuth(ADMIN, SUPER_ADMIN)` + `TenantScopeGuard` + `TenantActiveGuard` — copiar.
- Super Admin POST: o controller atual já dá 403 **sempre** (`if (req.user.roles?.includes(Roles.SUPER_ADMIN))`). Manter isso (sem pontapé).
- `rejectSecretTokenFields` no POST.
- Swagger DTO mensagem: `ConversationMessageResponseDto` em `dto/swagger/tenant-list.swagger.dto.ts` — pode mover/reusar.
- Registrar em `admin.module.ts`: trocar `ListConversationsController` / `ListConversationsService` pelos novos (ou renomear arquivos).
- `LeadListsService.getLead` deixa de ser pré-requisito do GET de mensagens.
- Phone da thread: campo `WhatsappConversation.phone` (já normalizado).

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/gym-ctrl/src/modules/admin/conversations.controller.ts` | criar (nome equivalente ok) |
| `apps/gym-ctrl/src/modules/admin/conversations.service.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/conversations.service.spec.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/dto/send-conversation-message.dto.ts` | criar ou reusar `send-list-conversation-message.dto.ts` |
| `apps/gym-ctrl/src/modules/admin/dto/swagger/*.ts` | editar/criar DTOs de thread |
| `apps/gym-ctrl/src/modules/admin/admin.module.ts` | editar |
| `list-conversations.controller.ts` / `.service.ts` / `.spec.ts` | deletar |

---

## 4.1 — Endpoints novos e remoção da API de lista

### O que fazer

`GET /tenant/:tenantId/conversations`

- Order `lastMessageAt desc`.
- Item: `id`, `phone`, `displayName`, `lastMessageAt`, `lastInboundAt`, `windowOpen` (`lastInboundAt >= now-24h`), `lastMessage` `{ id, direction, type, body, createdAt }` ou null.
- 404 se tenant não existe (padrão `LeadListsService` / `OpsService`).

`GET /tenant/:tenantId/conversations/:conversationId/messages?since=`

- 404 se thread não for do tenant.
- `since` ISO; inválido → 400.
- Select igual ao `MESSAGE_SELECT` atual; order `createdAt asc`.

`POST /tenant/:tenantId/conversations/:conversationId/messages` `{ text }`

- Só Admin (403 Super Admin no controller).
- 400 se tenant sem conta dedicada (`whatsappAccountId` null ou conta `isDefault`).
- 400 `OUTSIDE_MESSAGING_WINDOW` sem IN nas últimas 24h **nessa thread**.
- Graph + create OUT com `conversationId`; atualizar `lastMessageAt`.
- FROM = `resolveCredentials(tenantId)`.

Remover rotas `.../lead-lists/:listId/leads/:leadId/messages`. Tags Swagger: `Tenant — Conversations` (não `List Conversations`).

### Critérios de aceite

- [ ] GET lista threads não exige `listId`
- [ ] POST Super Admin → 403
- [ ] POST sem inbound 24h → 400 `OUTSIDE_MESSAGING_WINDOW` sem Graph
- [ ] POST sem dedicado → 400 sem Graph
- [ ] Controller antigo de lista não está no `AdminModule`

### Não fazer

- Não reintroduzir `listId` no JSON
- Não permitir Super Admin reply
- Não notificar WS no outbound (notifly/inbound only)

---

## 4.2 — Testes do service

### O que fazer

Espelhar `list-conversations.service.spec.ts`:

- Graph URL usa `phoneNumberId` dedicado quando o tenant tem FK.
- Não chama Graph fora da janela.
- 400 sem dedicado (mock `resolveCredentials` / prisma outreach config).
- GET messages filtra `conversationId` + `since`.

### Critérios de aceite

- [ ] Spec cobre dedicado vs rejeição sem dedicado
- [ ] Spec cobre janela 24h

### Não fazer

- Não testar e2e Nest completo nesta task
- Não alterar `platform-whatsapp-admin.service.ts` (resolver já existe)

---

## Verificação do grupo

Jest do spec novo; `AdminModule` compila sem `ListConversationsController`.

## Handoff para próxima task

Front/Postman (task 7) usam os paths novos. WS/push (task 5) apontam para `/tenant/{id}/conversations/{conversationId}`.
