# Task 5 — Gym-ctrl — send on-demand e dual-auth nas rotas existentes

**Change:** `tenant-api-keys-on-demand-send`
**Grupo:** 5 de 8
**Pré-requisitos:** [task-01](./task-01-schema-e-migration.md), [task-02](./task-02-shared-hash-de-chave-e-authguard-dual-mode.md), [task-03](./task-03-admin-grant-chaves-e-preco-on-demand.md), [task-04](./task-04-midia-upload-listagem-get-publico-e-cron-de-orfaos.md)
**Desbloqueia:** [task-07](./task-07-agendas-api-e-worker-horario.md), [task-08](./task-08-postman-front-integration-e-verificacao.md)

## Objetivo do grupo

POST de template granted para qualquer número (PWA e chave), persistir send **sem** debitar, gravar thread, e abrir GET de status + allowlist em templates/conversas.

## Contexto para o subagent

- Test-send (referência de Graph + slots, **não** copiar “sem coin”/plataforma): `whatsapp-templates.service.ts` `testSend` + `persistDedicatedTestSendConversation`. Bindings: `resolveTestSlotValue`. Payload: `buildTemplateSendBody` em `libs/shared/whatsapp-template-payload.ts`.
- Dedicated: `isDedicatedPlatformAccount` em `libs/shared/whatsapp-conversation.ts`. Inbox send já resolve credenciais por tenant: `conversations.service.ts` `platformWhatsapp.resolveCredentials(tenantId)` e 400 sem dedicado (~237).
- Grants: `template-grants.service.ts` `listGrantedTemplates`. POST deve 400/404 se o `templateId` não está granted **àquele** tenant.
- Super Admin 403 no POST: copiar o if de `conversations.controller.ts` linhas 129–131.
- Preço: `TenantOutreachConfig.costPerOnDemandSend`. Reserva: extrair ou duplicar de forma compartilhada a fórmula do design D4. Preferir helper em `apps/notifly/src/coin-reservation.ts` **movido/espelhado** para `libs/shared` se gym-ctrl e notifly precisam — se mover, grupo 6 usa o mesmo. Alternativa aceitável: função nova `libs/shared/on-demand-balance.ts` que gym-ctrl chama no preflight (counts Prisma) e grupo 6 alinha os crons. Não debitar aqui.
- HttpModule já no `admin.module.ts`.
- Controller templates tenant: `tenant-templates.controller.ts` — adicionar POST `:templateId/sends` **ou** controller irmão no mesmo prefixo. GET list existente: `@ApiKeyAllowlist`.
- Conversas: `conversations.controller.ts` — `@ApiKeyAllowlist` na class. POST texto já 403 Super Admin; chave passa.
- `source`: JWT → `ADMIN_JWT`; `authKind=api_key` → `API_KEY`.
- Phone: `normalizeBrazilPhoneDigits` / `normalizeListPhone` (já usados no test-send).
- Env `PUBLIC_API_BASE_URL` para `imageId` → header link.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/gym-ctrl/src/modules/admin/on-demand-sends.controller.ts` (ou métodos em tenant-templates) | criar/editar |
| `apps/gym-ctrl/src/modules/admin/on-demand-sends.service.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/dto/create-on-demand-send.dto.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/tenant-templates.controller.ts` | editar (allowlist + talvez POST) |
| `apps/gym-ctrl/src/modules/admin/conversations.controller.ts` | editar (allowlist) |
| `apps/gym-ctrl/src/modules/admin/admin.module.ts` | editar |
| `libs/shared/on-demand-balance.ts` (ou extensão de coin-reservation) | criar/mover |
| testes | criar |

---

## 5.1 — POST send com gates

### O que fazer

`POST /tenant/:tenantId/whatsapp-templates/:templateId/sends`

Body: `to` string; `variables?` Record<string,string>; `imageId?` string (publicId); `leadId?` int.

Gates em ordem sugerida: Super Admin 403 → tenant existe/ativo → `costPerOnDemandSend > 0` → dedicado → template granted + APPROVED → slots (texto + imageId do **mesmo** tenant → URL pública; se falta header.image 400; se `PUBLIC_API_BASE_URL` ausente e precisa URL 400) → `available >= cost` (balance da carteira do tenant via mesmo `resolveWalletUserId` conceito: `coin.findFirst({ tenantId })`) → Graph no phoneNumberId dedicado.

Não chamar o test-send de plataforma (`whatsappAccountId` default compartilhado).

### Critérios de aceite

- [ ] Happy path 201 com wamid
- [ ] Super Admin 403 sem Graph
- [ ] Sem dedicado / ungranted / preço 0 / saldo insuficiente → 400 sem Graph

### Não fazer

- Não debitar coins
- Não usar a conta default da plataforma

---

## 5.2 — Persistência send + thread

### O que fazer

Após Graph 200: criar `TenantOnDemandSend` (`coinDebitedAt` null, `wamid`, `variables`, `mediaId?`, `source`, `apiKeyId?`). Upsert conversa `(tenantId, phone)` e message `OUT` `type=template` (copiar `persistDedicatedTestSendConversation`, mas **já sabemos** o tenant — não resolver por `whatsappAccountId` invertido). Ligar `conversationId` no send se o schema tiver o campo.

### Critérios de aceite

- [ ] Row send sem débito
- [ ] Thread + mensagem template com o mesmo wamid

### Não fazer

- Não persistir send cobrável em 4xx de preflight

---

## 5.3 — GET status e allowlist

### O que fazer

`GET /tenant/:tenantId/on-demand-sends` cap 100 `sentAt` desc; query opcional depois. `GET .../:sendId` 404 se outro tenant. Payload: id, wamid, phone, templateId, lastStatus, sentAt, conversationId, latestError se houver (join opcional `WhatsappSendStatus` — pode ser null até o grupo 6 gravar). Super Admin GET ok.

`@ApiKeyAllowlist` em: GET templates granted, POST send, GET sends, class de conversations.

### Critérios de aceite

- [ ] Chave lista templates granted (não o catálogo platform)
- [ ] Chave GET/POST conversas no próprio tenant
- [ ] Chave em rota sem decorator continua 401 (smoke)

### Não fazer

- Não allowlist em coins, users, outreach-config write, api-keys, platform

---

## 5.4 — Testes

### O que fazer

Mock HttpService/Graph. Casos: ok, Super Admin, ungranted, não APPROVED, default number, preço 0, missing image, image de outro tenant, Graph 200 não chama `coin.update`.

### Critérios de aceite

- [ ] Specs passam

### Não fazer

- Não implementar webhook neste grupo

---

## Verificação do grupo

POST send (teste) + GET templates com metadata allowlist; conversations class allowlist.

## Handoff para próxima task

`wamid` existe em `TenantOnDemandSend` para o webhook (grupo 6) ligar status e debitar.
