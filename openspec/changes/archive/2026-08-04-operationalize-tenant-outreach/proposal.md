## Why

O schema já é multi-tenant e marketplace (Lead global + TenantLead), mas a operação ainda depende de IDs hardcoded (tenant 4/8), mapa UUID→telefone em memória, Phone Number ID Meta e pricing no código. Isso impede onboarding de novos tenants sem deploy e impede rodar outreach de forma segura com a Cloud API oficial.

## What Changes

- Persistir configuração operacional de outreach por tenant (enabled, pricing, cashback, templates, schedule, categorias elegíveis).
- Persistir referência à conta WhatsApp Cloud API da **plataforma** (phoneNumberId; token continua em env/secret).
- Usar `Tenant.uuid` + `Tenant.phone` no welcome (`/sites/welcome/:uuid`) em vez do mapa hardcoded.
- Tornar `Tenant.phone` obrigatório para tenants com outreach habilitado (número válido para contato/aviso ao tenant).
- Remover filtros hardcoded `tenantId: 8` (e caminhos equivalentes no notifly) — elegibilidade via flags/`TenantOutreachConfig` + saldo.
- Unificar envios produtivos no **WhatsApp Cloud API** (notifly). Baileys/captura outbound permanece fora de escopo (legado futuro).
- Ajustar inconsistências leves de schema ligadas a este fluxo (`messageId` documentado como correlation id Meta; flags no Tenant quando fizer sentido).
- **Não** inclui painel super admin UI, ScrapeJob, PlatformUser, nem ativação/refatoração do Baileys.

## Capabilities

### New Capabilities

- `tenant-outreach-config`: configuração e elegibilidade de outreach por tenant (enabled, custo, cashback, templates, agenda, categorias).
- `platform-whatsapp-cloud`: conta Cloud API da plataforma usada para todos os envios oficiais (templates outbound + notificação ao tenant).
- `tenant-welcome-redirect`: resolução welcome por `Tenant.uuid` → redirect WhatsApp usando `Tenant.phone`.
- `cloud-outreach-runtime`: cron/contato de leads no notifly lendo configs do DB, debitando coins e correlacionando respostas via `messageId` (wamid).

### Modified Capabilities

- _(nenhuma — `openspec/specs/` ainda não possui capabilities existentes)_

## Impact

- **Schema/DB:** `prisma/schema.prisma` + migration(s) novas (`TenantOutreachConfig` e/ou flags em `Tenant`; modelo de conta WhatsApp da plataforma).
- **Apps:** `apps/notifly` (`leads.service.ts`, `WhatsappController.ts`, possivelmente module/DI); leitura de env (`WHATSAPP_TOKEN`, eventualmente `WHATSAPP_PHONE_NUMBER_ID`).
- **Não altera:** fluxos Baileys em `apps/captura`, scraper, gym-ctrl UI, seeds legados (`leads.json`) além do necessário para não quebrar compile.
- **Runtime:** dependência contínua de PostgreSQL + Meta Graph API; sem nova dependência npm obrigatória.
- **Operação:** onboarding de tenant passa a ser dados no DB (+ secret do token de plataforma), não patch de código.
