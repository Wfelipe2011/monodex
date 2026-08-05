# NOTES — operationalize-tenant-outreach

Handoff de verificação (grupo 5). Escrito a partir de inspeção estática do código entregue (grupos 1–4) + gap analysis do que exige Meta Cloud API ao vivo. Sem painel admin; sem ativação de Baileys.

**Data da verificação:** 2026-08-04  
**Ambiente:** offline / code review no workspace `monodex` (sem chamada real à Graph API nesta sessão)

---

## Caminho oficial vs legado

| Canal | Papel nesta change | Status |
|-------|--------------------|--------|
| **WhatsApp Cloud API via `apps/notifly`** | Único caminho oficial de outreach outbound | Implementado (grupos 2–3) |
| **Baileys (`baileys.wfelipe.com.br`) + `apps/captura` `contactLeads`** | Legado / futuro | **Fora do escopo** — código preservado; cron continua comentado |

Não deletar código Baileys. Próxima exploração natural: proposta Baileys opcional, painel super admin, ou `tenantId` em `Message`.

---

## Checklist manual (5.1)

Legenda: **PASS** = confirmado por inspeção de código / artefatos; **MOCKED** = comportamento inferível sem Meta; **UNVERIFIED** = exige runtime + Meta (ou segundo tenant seeded).

### 1. Welcome (`GET /sites/welcome/:uuid`)

| # | Cenário | Resultado | Evidência / como verificar |
|---|---------|-----------|----------------------------|
| 1.1 | UUID de tenant com `phone` válido → redirect `wa.me` | **PASS** (código) / **UNVERIFIED** (HTTP ao vivo) | `WhatsappController`: `findUnique` por `uuid` sanitizado (`{{1}}` removido); `res.redirect(https://wa.me/+{digits}?text=...)` |
| 1.2 | UUID inexistente ou tenant sem phone → `public/index.html` | **PASS** (código) / **UNVERIFIED** (HTTP) | Early return `res.sendFile(.../public/index.html)` quando `!tenant?.phone` |
| 1.3 | Mapa em memória `tenats` removido | **PASS** | Controller só usa `PrismaService`; sem mapa hardcoded |

**Offline:** leitura de `apps/notifly/src/WhatsappController.ts`.  
**Com Meta/WA:** desnecessário para redirect; basta notifly + DB com `Tenant.uuid`/`phone`.

### 2. Cron / seleção de tenants

| # | Cenário | Resultado | Evidência / como verificar |
|---|---------|-----------|----------------------------|
| 2.1 | Seleção sem `tenant.id: 8` hardcoded | **PASS** | `findMany` com `outreachConfig.enabled: true` + phone não nulo/vazio |
| 2.2 | Filtro por `schedule` da config | **PASS** (código) | `isWithinSchedule(config.schedule, day, hour)` — fora da janela → skip + log |
| 2.3 | Saldo ≥ `costPerLead` | **PASS** (código) | Skip + warn se coin insuficiente |
| 2.4 | ≥2 tenants enabled em dev com logs de seleção | **MOCKED / UNVERIFIED** | Seed atual (`prisma/seed-outreach.ts`) habilita **1** tenant (default id 8 ou `TENANT_ID`). Para 2 tenants: upsert segunda `TenantOutreachConfig` manualmente e observar logs `[handleCron] Encontrados N tenants...` |

**Offline:** confirmar ausência de filtro por id e presença de include `outreachConfig`.  
**Runtime:** disparar `handleCron` (ou reiniciar notifly — `onModuleInit` chama o cron) com configs enabled.

### 3. Send Cloud (outbound template)

| # | Cenário | Resultado | Evidência / como verificar |
|---|---------|-----------|----------------------------|
| 3.1 | URL usa `phoneNumberId` da conta plataforma (não hardcoded) | **PASS** (código) | `PlatformWhatsappService.resolveCredentials()` → `graph.facebook.com/v22.0/{phoneNumberId}/messages`; seed coloca `688645744332614` no **DB**, não no service |
| 3.2 | Token só via `process.env[tokenEnvKey]` | **PASS** | Schema `tokenEnvKey` default `WHATSAPP_TOKEN`; nunca persistido |
| 3.3 | Template = `outreachTemplateName` da config | **PASS** (código) | Body usa `config.outreachTemplateName` |
| 3.4 | `TenantLead.messageId` = wamid da resposta Graph | **PASS** (código) / **UNVERIFIED** (Meta) | `messageId: res.data.messages[0].id` |
| 3.5 | Débito coin = `costPerLead` | **PASS** (código) / **UNVERIFIED** (DB ao vivo) | `decrement: config.costPerLead` + `CoinTransaction` DEBITO |

**Offline:** review de `platform-whatsapp.service.ts` + `leads.service.ts` `contactLeads`.  
**Precisa Meta:** POST Graph real, template aprovado (`amigavel`), `WHATSAPP_TOKEN` válido, lead/phone elegível.

### 4. Webhook correlação + reply “Sim”

| # | Cenário | Resultado | Evidência / como verificar |
|---|---------|-----------|----------------------------|
| 4.1 | Lookup `TenantLead` por `messageId === body.context.id` | **PASS** (código) | `responseLeads` `findFirst` / `updateMany` por `messageId` |
| 4.2 | Button “Sim” → notify `Tenant.phone` com template da config | **PASS** (código) / **UNVERIFIED** (Meta) | `to: 55{tenant.phone}`; template `config.notifyTenantTemplateName` |
| 4.3 | Cashback = `cashbackOnReply` | **PASS** (código) / **UNVERIFIED** (DB) | `increment` + `CoinTransaction` CREDITO; seed = `0` |
| 4.4 | Sem config → skip notify/cashback com warn | **PASS** (código) | Early return se `!outreachConfig` |

**Offline:** review de `responseLeads`.  
**Precisa Meta (ou mock webhook):** payload com `context.id` = wamid gravado + `type: button`, `button.text === 'Sim'`. Mock possible: POST interno no controller webhook do notifly com body sintético apontando a um `TenantLead.messageId` de teste.

---

## O que verificar offline vs o que precisa Meta

### Verificável offline (sem Meta)

- Schema/migration `WhatsappAccount` + `TenantOutreachConfig`
- Seed idempotente plataforma + config do tenant operacional
- Welcome: lógica Prisma/redirect/fallback HTML
- Cron: ausência de id mágico; filtro enabled/phone/schedule/saldo
- Montagem de URL Graph e resolução de token por env key
- Persistência prevista de `messageId`, débito/crédito a partir da config
- Correlação webhook por wamid no código
- Escopo Baileys fora (cron captura comentado)

### Precisa Meta Cloud API (ou mock HTTP da Graph)

- Envio real de template outbound
- Preenchimento real de `TenantLead.messageId` com wamid válido
- Entrega da mensagem ao lead e reply “Sim” no WhatsApp
- Notify real ao `Tenant.phone`
- Cashback em saldo real após reply (valor seed 0 → conferir transaction mesmo assim)

### Mockável sem WhatsApp humano

- Resposta Graph: mock axios/HttpService retornando `{ messages: [{ id: 'wamid.test' }] }`
- Webhook: chamar `responseLeads` com `{ type: 'button', button: { text: 'Sim' }, context: { id: 'wamid.test' } }`
- Segundo tenant: SQL/Prisma upsert de config + phone + coin

**Nenhum passo do checklist acima exige Baileys para passar.**

---

## Artefatos de implementação (grupos 1–4) — referência rápida

| Peça | Path |
|------|------|
| Schema | `prisma/schema.prisma` (`WhatsappAccount`, `TenantOutreachConfig`) |
| Migration | `prisma/migrations/20260805021528_add_whatsapp_account_and_tenant_outreach_config/` |
| Seed | `prisma/seed-outreach.ts` |
| Conta plataforma | `apps/notifly/src/platform-whatsapp.service.ts` |
| Cron + send + webhook | `apps/notifly/src/leads.service.ts` |
| Welcome | `apps/notifly/src/WhatsappController.ts` |
| Module wiring | `apps/notifly/src/notifly.module.ts` |

---

## Open questions remanescentes (handoff)

1. **Billing user canônico:** débito/crédito usa `user.findFirst({ tenantId })` + `Coin` composto `(userId, tenantId)`. Qual user é canônico se houver vários?
2. **Categories / website filters:** hoje só na `TenantOutreachConfig` + filtros de website hardcoded no `contactLeads` do notifly. Haverá regras globais depois?
3. **Captura Baileys:** cron de `contactLeads` permanece comentado até uma proposta futura dedicada — não reativar como parte desta change.

---

## Como fechar verificação E2E (próximo operador)

1. `npx prisma migrate deploy` + `npx ts-node prisma/seed-outreach.ts` (+ opcional segundo tenant com config).
2. Garantir `WHATSAPP_TOKEN` no env do notifly.
3. Hit `GET /sites/welcome/{uuid}` com uuid real e um inválido.
4. Forçar janela de schedule ou chamar `handleCron`; confirmar logs de seleção e (com Meta) `TenantLead` + coin debit.
5. Simular ou aguardar webhook “Sim”; confirmar notify + cashback transaction.
6. Confirmar que captura **não** enviou via Baileys (cron continua desligado).

Pronto para `/opsx-archive` após merge, ou proposta futura Baileys / super admin.
