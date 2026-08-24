## Context

Auth do gym-ctrl é JWT global (`AuthGuard` + `RolesGuard`). Rotas `/tenant/:tenantId/*` usam `TenantScopeGuard` / `TenantActiveGuard` e identidade `UserToken` (`userId`, `tenantId`, `roles`). Não existe API key. Envio de template sob demanda para o tenant também não: o POST de template é test-send de **plataforma** (`POST /platform/whatsapp-templates/:id/test`, Super Admin, sem coin). Disparos cobrados são cron de cidade (`costPerLead`) e lista (`costPerSend`), com débito no webhook (`CoinDebitOnStatusService`, gatilho `coinDebitOnStatus`).

Inbox exige número Cloud API **dedicado**. Header de template Graph usa `{ image: { link: "https://..." } }` — hoje a arte costuma viver em URL pública (GitHub). Convites já hasheiam secret com SHA-256 (`libs/shared/invite-token.ts`). Jobs configuráveis: `PlatformJobSchedule` + `PlatformJobKey` (`WHATSAPP_TEMPLATE_SYNC`, `SCRAPE`), cron de 5 campos, timezone `America/Sao_Paulo`.

Esta change abre um **terceiro canal** (on-demand) autenticável por JWT ou `X-API-KEY`, cobrado com preço próprio, com mídia interna e agenda pontual.

## Goals / Non-Goals

**Goals:**

- Super Admin liga/desliga API no tenant; Admin cria até 3 chaves ativas.
- Dual-auth na allowlist; identidade de chave = Admin do tenant (sem `userId` humano).
- Send on-demand (agora ou agendado) para número livre, template granted, dedicado, thread `OUT template`.
- Terceiro preço `costPerOnDemandSend`; mesmo gatilho/idempotência/reserva de `coin-debit-on-status`.
- Biblioteca de imagens + GET público HTTPS para a Meta + limpeza de órfãos.
- Super Admin só lê este canal (POST/upload/cancel 403).

**Non-Goals:**

- Volume persistente / S3 / CDN (MVP: disco local + cron de órfãos).
- Abrir cidade, lista, scrape, coins, users, convites, WS ou web push via chave.
- Escopos por chave (todas as ativas têm a mesma allowlist).
- Test-send de catálogo (`/platform/whatsapp-templates/:id/test`) e notify-ao-tenant.
- Rate limit sofisticado (pode vir depois; log de `lastUsedAt` basta no MVP).
- UI no monorepo.

## Decisions

### D1 — Grant na `Tenant` + chaves hasheadas (espelho do convite)

`Tenant.apiAccessEnabled Boolean @default(false)` escrito só por Super Admin (`PATCH /platform/tenants/:id`). Sem grant, POST de chave 403 e autenticação por chave 401 (mesmo se a row ainda existir).

`TenantApiKey`: `id`, `tenantId`, `name`, `prefix`, `keyHash` (unique), `lastUsedAt`, `revokedAt`, `createdAt`. Plaintext só no 201. Lookup: `sha256(raw)` = `keyHash` (igual `hashInviteToken`). Prefixo só para UI (ex. `mdx_live_ab12`).

Teto: **3 com `revokedAt` null**. Revogada não conta. Regenerar = revogar + criar.

**Alternativa rejeitada:** JWT de máquina de longa duração — não dá para revogar uma integração sem derrubar o Admin humano.

### D2 — Dual-auth no `AuthGuard`, allowlist por metadata

Header `X-API-KEY` presente → resolve hash, exige `apiAccessEnabled`, tenant `active` para escrita (leitura segue `TenantActiveGuard`), monta `request.user` sintético: `tenantId`, `roles: [ADMIN]`, `apiKeyId`, `authKind: 'api_key'` (sem `userId`). Bearer JWT permanece o fluxo atual. **Os dois juntos:** 400.

Rotas que aceitam chave recebem decorator (ex. `@ApiKeyAuth()`). Sem decorator, chave válida ainda é **401**. `/platform/*` nunca entra na allowlist. `@Public()` continua sem JWT nem chave (GET de mídia).

`RolesGuard` / `TenantScopeGuard` reutilizam o user sintético (`ADMIN` + `tenantId`). POST que hoje bloqueia Super Admin (`conversations.sendTextMessage`) continua 403 para Super Admin JWT; chave **pode** POST porque não tem role SUPER_ADMIN.

CORS: incluir `X-API-KEY` em `allowedHeaders`.

**Alternativa rejeitada:** prefixo `/v1` separado — duplica controllers. Paths atuais + allowlist entregam PWA e integrador no mesmo contrato.

### D3 — Terceiro preço em `TenantOutreachConfig`

`costPerOnDemandSend Float @default(0)` plataforma (mesmo eixo de `costPerLead`). Super Admin PATCH `/platform/tenants/:tenantId/outreach-config`. Admin GET vê, PATCH 403. `<= 0` → canal fechado (400 no send/agenda), igual lista com `costPerSend <= 0`.

Gatilho de momento = `coinDebitOnStatus` já existente. Sem gatilho paralelo.

PWA e chave usam o **mesmo** preço.

### D4 — Modelo `TenantOnDemandSend` + billing no webhook

Não reusar `TenantLead` nem `TenantListSend` (canais diferentes, sem lead de cidade/lista obrigatório).

Campos mínimos: `tenantId`, `templateId`, `phone`, `wamid` unique, `variables` Json, `mediaId?`, `source` (`ADMIN_JWT` | `API_KEY` | `SCHEDULE`), `apiKeyId?`, `scheduleId?`, `lastStatus`, `coinDebitedAt`, `coinRefundedAt`, `sentAt`, `conversationId?`.

`WhatsappSendStatus.onDemandSendId?` — XOR informal com `listSendId` / `tenantLeadId` (um wamid, um canal).

`CoinDebitOnStatusService.applyAfterStatus` ganha `onDemandSendId`. Cost = `costPerOnDemandSend`. Description `DEBITO`/`CREDITO` inclui `origin=on_demand` e `wamid=`. Graph 200 **não** debita. `failed` estorna se já debitou. Send que falha **antes** do Graph não cria row cobrável (ou cria `FAILED_PREFLIGHT` sem wamid — preferir **não persistir send cobrável** e só logar/devolver 4xx; agenda marca `FAILED` na row de schedule).

Reserva: `available = balance - pendingCity*costPerLead - pendingList*costPerSend - pendingOnDemand*costPerOnDemandSend` (pending = `coinDebitedAt` null e `lastStatus` distinto de `failed`). Send on-demand e crons de cidade/lista **todos** usam essa conta para não overspend cruzado. Agendas `PENDING` cujo `scheduledFor` já chegou ou está na janela da hora também contam como pending deste canal (1 × `costPerOnDemandSend` cada) **ou** reserva só após Graph 200 — decisão: contar **após aceite Graph** (igual cidade/lista) + no preflight do POST imediato exigir `available >= cost` na hora. Agenda na hora H faz o mesmo preflight; se falhar, `FAILED` sem Graph.

### D5 — Send agora: um POST, dois callers

`POST /tenant/:tenantId/whatsapp-templates/:templateId/sends`

Body:

```json
{
  "to": "11999999999",
  "variables": { "body.1": "João" },
  "imageId": "<uuid público da mídia>",
  "leadId": 1
}
```

- `variables`: texto livre por slot key (mesmo mapa do test-send).
- `imageId`: preenche `header.image` com a URL pública da mídia do **mesmo tenant**. Se o template exige header image e não veio `imageId` nem `variables['header.image']` → 400.
- `leadId` opcional: resolve bindings `lead.*` como o test-send; destino continua sendo `to`, não o telefone do lead.
- Template MUST estar granted + `APPROVED`.
- Credenciais = conta dedicada do outreach config; sem dedicado → 400.
- Super Admin JWT → 403. Admin JWT ou API key → 201 `{ id, wamid, to, messageStatus, conversationId }`.
- Persistência de thread: reusar o caminho de `persistDedicatedTestSendConversation` (upsert `(tenantId, phone)`, `OUT` `type=template`).

`GET /tenant/:tenantId/on-demand-sends` (últimos 100, `sentAt` desc) e `GET .../:sendId` devolvem `lastStatus` + últimos erros (status B). Status C continua nos GETs de conversa (`windowOpen`, `lastInboundAt`).

Listagem de templates: o GET atual `/tenant/:tenantId/whatsapp-templates` entra na allowlist (mesmo payload granted).

### D6 — Mídia no disco do gym-ctrl + GET público

Pasta configurável (default `uploads/tenant-media`, gitignore). Row `TenantMedia`: `id`, `publicId` (uuid, unique), `tenantId`, `originalFileName`, `mimeType`, `relativePath`, `byteSize`, `createdAt`.

- `POST /tenant/:tenantId/media` multipart (JWT ou chave). MIME `image/jpeg` | `image/png` | `image/webp`. Tamanho máx. 5 MB (header Meta).
- `GET /tenant/:tenantId/media` lista do tenant (sem path interno).
- `GET /public/media/:publicId` `@Public()` — `Content-Type` + bytes. Id sequencial **não** aparece na URL pública.
- URL Graph: `{PUBLIC_API_BASE_URL}/public/media/{publicId}` (env novo, espelha `INVITE_PUBLIC_BASE_URL`; HTTPS em prd já existe).

Limpeza: `PlatformJobKey.ORPHAN_MEDIA_CLEANUP` default `0 3 1,16 * *` (aprox. 15 dias), timezone SP, Super Admin altera pelo CRUD já existente de job schedules. **Roda no gym-ctrl** (quem escreve o disco), padrão `DynamicScrapeCronService` (poll 60s + `CronJob.from`). Varre o diretório; apaga arquivo cujo `relativePath` **não** tem row. Não apaga row órfã sem arquivo.

**Fora do MVP:** volume Docker/S3. Sem volume, redeploy perde arquivos — aceito.

### D7 — Agenda por data e hora (não minuto)

`TenantOnDemandSchedule`: `tenantId`, `templateId`, `phone`, `scheduledFor` (UTC do início da hora em `America/Sao_Paulo`), snapshot `variables` Json + `mediaId?` + `leadId?`, `status` (`PENDING` | `CANCELLED` | `SENT` | `FAILED`), `failedReason?`, `onDemandSendId?`, `cancelledAt?`, `createdAt`.

`POST /tenant/:tenantId/on-demand-schedules` — hora no passado → 400. Cancelar só `PENDING` (`POST .../:id/cancel`). Listar/GET: Admin + Super Admin lê; Super Admin não cria/cancela.

Worker: `PlatformJobKey.ON_DEMAND_SCHEDULE_RUN` default `0 * * * *` **no notifly** (envio Graph + billing). Cada tick: agendas `PENDING` com `scheduledFor <= now` (hora atual SP). Preflight (ativo, grant, APPROVED, dedicado, preço > 0, mídia existe, `available >= cost`) falha → `FAILED` + reason, sem Graph, sem débito. Sucesso → mesmo pipeline do POST imediato, `source=SCHEDULE`, `status=SENT`.

Cancelável até o worker pegar a row (update condicional `PENDING` → `SENT`/`FAILED`).

### D8 — Allowlist explícita

| Método | Path | JWT Admin | JWT Super Admin | API key |
|--------|------|-----------|-----------------|---------|
| GET | `/tenant/:id/whatsapp-templates` | sim | sim | sim |
| POST | `/tenant/:id/whatsapp-templates/:tid/sends` | sim | 403 | sim |
| GET | `/tenant/:id/on-demand-sends` (+ `:sendId`) | sim | sim | sim |
| GET/POST | `/tenant/:id/conversations...` | sim | GET sim / POST 403 | sim |
| POST/GET | `/tenant/:id/media` | sim | GET sim / POST 403 | sim |
| GET | `/public/media/:publicId` | público | público | público |
| CRUD | `/tenant/:id/on-demand-schedules` | sim (cancel/create) | GET sim / write 403 | sim |
| GET/POST | `/tenant/:id/api-keys` | sim (create/revoke) | GET sim / write 403 | **não** |
| PATCH | `/platform/tenants/:id` `apiAccessEnabled` | — | sim | não |
| PATCH | `/platform/.../outreach-config` `costPerOnDemandSend` | — | sim | não |

Chave **não** gerencia chaves (evita que uma integração revogue as outras sem o humano).

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Disco efêmero some com as imagens no redeploy | Aceito no MVP; cron só limpa órfãos; follow-up volume/S3 |
| Meta não alcança GET público | Prd já é HTTPS; `PUBLIC_API_BASE_URL` absoluto; 400 se env ausente no send com header image |
| Overspend entre cidade/lista/on-demand | Reserva unificada (D4) |
| Chave vazada | Hash at rest, teto 3, revoke, `lastUsedAt`, grant Super Admin desliga tudo |
| Allowlist furada (`/platform`, coins) | Decorator opt-in; teste: chave válida em rota fora → 401 |
| Worker de agenda duplicado (2 instâncias notifly) | Update condicional `PENDING` → `SENT` na mesma transação do Graph |
| Cron `1,16` ≠ 15 dias exatos | Documentar; Super Admin ajusta a expressão |
| Enumerar mídia | UUID na URL pública, não id sequencial |

## Migration Plan

1. Prisma: flags, models, `costPerOnDemandSend` default 0, `onDemandSendId` em status, `PlatformJobKey` novos + seed dos dois jobs.
2. gym-ctrl: guard + CRUD chaves/mídia/send/agenda + GET público + cron órfãos. Cutover único com notifly (billing on-demand).
3. notifly: `applyAfterStatus` + resolve wamid on-demand + worker horário + reserva unificada nos crons cidade/lista.
4. Sem backfill de cobrança (canal novo). Tenants nascem `apiAccessEnabled=false` e preço 0 (canal fechado).
5. Rollback: desligar `apiAccessEnabled` / preço 0; jobs `enabled=false`; código revertível se ninguém dependeu das rows.

## Open Questions

Nenhum bloqueante. Assunções:

- Granularidade da agenda é **hora**, não minuto.
- `leadId` no send é opcional só para preencher `lead.*`; o `to` manda.
- Upload via chave habilitado (além do PWA).
- Cleanup e files no gym-ctrl; disparo agendado no notifly.
