# Avaliação banco de dados — o que está / o que deveria estar

> Artefato de exploração (2026-08-04). Destinado a um agent avaliar modelagem Prisma, gaps de persistência e propostas de schema.
> Cruzar com `03-avaliacao-multi-tenant.md` e `02-painel-super-admin.md`.

## Inventário do que JÁ está no banco

Schema: `prisma/schema.prisma` · Provider: PostgreSQL · Client: Prisma 6.

### Domínio de plataforma / tenant

| Tabela | Conteúdo |
|--------|----------|
| `tenants` | id, name, uuid, phone?, timestamps |
| `users` | credentials + roles + tenant_id |
| `whatsapp_sessions` | session_data JSON por user/tenant |
| `webhooks` | target, trigger, filter, secret, enabled |
| `contacts` | contact_information, type (INDIVIDUAL/GROUP), user_id |

### Domínio de leads / marketplace

| Tabela | Conteúdo |
|--------|----------|
| `leads` | name, phone unique, website, category, rating, reviews, temperature, soft delete |
| `tenant_leads` | vínculo + funil (contacted, replied, quoted, closed, deleted) + message_id? |
| `user_leads` | quem adquiriu / quando |
| `cities` / `neighborhoods` | geo para scraper |

### Domínio financeiro (coins)

| Tabela | Conteúdo |
|--------|----------|
| `coins` | balance por user+tenant |
| `coin_transactions` | amount, type, temperature, lead opcional, description |

### Domínio mensagens (recente)

| Tabela | Conteúdo |
|--------|----------|
| `whatsapp_contacts` | name?, phone unique |
| `messages` | body, direction ENTRADA/SAIDA, contact FK |

Enums úteis já existem: `Temperature`, `CoinTransactionType`, `Roles`, `TypeTrigger`, `MessageDirection`.

---

## O que está FORA do banco (mas opera o produto)

### 1. Configuração operacional hardcoded

| Dado | Onde está hoje | Deveria estar? |
|------|----------------|----------------|
| Mapa UUID → telefone welcome | `WhatsappController.ts` (`tenats = {...}`) | `Tenant.phone` + lookup por `Tenant.uuid` (**já tem colunas!**) |
| Meta Phone Number ID `688645744332614` | URL em `notifly/leads.service.ts` | Config de conta WhatsApp (plataforma ou por tenant) |
| `WHATSAPP_TOKEN` | env | OK em secret/env; referência da conta no DB |
| Templates (`amigavel`, `lembrete_entrar_contato_cliente`) | código | Tabela de templates / config tenant |
| Texto comercial / persona ("Giulia…") | código captura/notifly | Config de copy por tenant |
| Preço do lead `0.35` | código | Pricing table ou campo em tenant |
| Cashback resposta | código (`0.00`) | idem |
| Janela de cron (dias/horas) | decorators + filtros | Preferências por tenant (`outreach_schedule`) |
| Tenant elegível no cron (`id: 8`) / captura (`4`) | código | Flag `outreachEnabled` + saldo |
| Categorias / filtros de website do scraper | código | Regras/config (global ou por job) |
| Lista de cidades a scrapar no boot | código comentado | `cities` + fila de jobs |

### 2. Arquivos / scripts paralelos ao DB

| Artefato | Papel | Problema |
|----------|-------|----------|
| `leads.json` | Dump legado flat (contacted/replied no próprio lead) | Modelo antigo; DB atual separou isso em `tenant_leads` |
| `seed.ts` | Lê JSON, query phones | Não popula DB de forma útil |
| `adquirirLeads.ts` | Importa contacted → tenant 4 | One-off, IDs fixos |

### 3. Secrets (ok fora do DB)

- `DATABASE_URL`, `JWT_SECRET`, `WHATSAPP_TOKEN` → permanecem em env/secret manager.
- Hash de password do user NÃO deve ir para config de integração sem modelo explícito (hoje o captura reusa password hash do user 4 no Baileys — acoplamento frágil).

---

## Gaps de modelagem (o que FALTA criar)

Sugestões para o agent de DB avaliar (não fechar sozinho):

### A. Conta / integração WhatsApp

```
WhatsappAccount (?)
  - id, provider (CLOUD_API | BAILEYS)
  - phoneNumberId, wabaId?, displayPhone?
  - tokenRef (apontar secret, não guardar token em claro se possível)
  - tenantId? NULL = conta da plataforma
  - enabled
```

Hoje: tudo implícito numa única URL Graph.

### B. Config de outreach por tenant

```
TenantOutreachConfig (?)
  - tenantId
  - enabled
  - costPerLead
  - cashbackOnReply
  - templateName
  - copyPersona / description
  - schedule (cron expression ou JSON dias/horas)
  - maxDailyContacts
```

### C. Jobs de captura

```
ScrapeJob (?)
  - cityId / neighborhoodId
  - category
  - status, lastRunAt, nextRunAt
  - ownedBy (platform vs tenant) — depende da decisão marketplace
```

### D. Platform admin

Se painel super admin avançar:

```
PlatformUser (?)  OU  Role SUPER_ADMIN em users sem tenant
  - preferir PlatformUser separado para não poluir User tenant-scoped
```

### E. Message / Contact com tenant

```
WhatsapContact / Message → + tenantId (ou whatsappAccountId)
Contacts → + tenantId (denormalizado) para queries seguras
```

### F. Soft flags no Tenant

Já tem `phone` e `uuid`. Faltam coisas como `active`, `outreachEnabled`, limites.

---

## Inconsistências schema ↔ uso

| Issue | Detalhe |
|-------|---------|
| Email `@unique` + `@@unique([email, tenantId])` | Unique global vence; composto é redundante |
| `User.roles` default `[ADMIN]` | Todo user nasce admin do tenant |
| `TenantLead.messageId` | String solta; relation com `Message` inexistente |
| `Session.sessionData` Json | Opaco — ok para Baileys, documentar |
| `Webhooks` | Model existe; superfície de API/uso aparente baixa |
| `Lead.temperature` vs funil em `TenantLead` | Temperature no lead global; funil no join — ok se conscientemente marketplace |
| Typo model `WhatsapContact` | Débito técnico de naming |

---

## Migrations existentes (contexto)

Pastas em `prisma/migrations/` (nomes indicam evolução):

- cria cidades
- adiciona phone em tenants
- muda tipo coluna
- tabela messages
- outras incrementais

Agent deve validar se `migrate deploy` limpo cria schema alinhado ao `schema.prisma` atual.

---

## O que NÃO precisa ir pro banco

| Item | Motivo |
|------|--------|
| JWT secret | Secret |
| Prisma connection string | Infra |
| HTML estático de fallback (`public/index.html`) | Asset |
| binaryTargets do Prisma | Build |

---

## Prioridade sugerida (valor × esforço)

| Prioridade | Mudança | Esforço | Desbloqueia |
|------------|---------|---------|-------------|
| P0 | Usar `Tenant.phone`/`uuid` no welcome (sem schema novo) | Baixo | Onboarding sem deploy de código |
| P0 | Remover hardcodes tenant 4/8 → ler tenants do DB | Médio | Multi-tenant operacional |
| P1 | `TenantOutreachConfig` + pricing | Médio | Painel admin útil |
| P1 | `WhatsappAccount` | Médio/Alto | Multi-número / rotação |
| P2 | `ScrapeJob` | Médio | Captura controlável |
| P2 | tenantId em messages/contacts | Médio | Isolamento/auditoria |
| P3 | PlatformUser | Médio | Super admin limpo |
| P3 | Limpar `leads.json` / seeds oficiais | Baixo | DX |

---

## Perguntas para o agent fechar

1. Marketplace confirmado? (`Lead` global fica)
2. WABA única da plataforma vs conta por tenant?
3. Baileys (`Session`) ainda é caminho produtivo ou legado vs Cloud API do notifly?
4. `Webhooks` e `Contacts` estão em uso ou são antecipação?
5. Precisa de histórico de preços / auditoria financeira além de `coin_transactions`?
6. Soft-delete de tenant ou hard delete?

---

## Arquivos-chave

- `prisma/schema.prisma`
- `prisma/migrations/**`
- `apps/notifly/src/leads.service.ts` (Graph URL, pricing, templates)
- `apps/notifly/src/WhatsappController.ts` (mapa UUID)
- `apps/captura/src/leads.service.ts` (hardcodes + Baileys)
- `apps/captura/src/scraper/*.ts`
- `seed.ts`, `adquirirLeads.ts`, `leads.json`
- `libs/infra/prisma/`
