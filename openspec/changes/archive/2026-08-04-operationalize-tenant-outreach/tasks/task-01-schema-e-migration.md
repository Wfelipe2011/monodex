# Task 1 — Schema e migration

**Change:** `operationalize-tenant-outreach`
**Grupo:** 1 de 5
**Pré-requisitos:** nenhum
**Desbloqueia:** [2](./task-02-conta-cloud-api-da-plataforma.md), [3](./task-03-config-de-outreach-no-runtime-notifly.md), [4](./task-04-welcome-redirect-por-tenant.md)

## Objetivo do grupo

Persistir no PostgreSQL (via Prisma) a conta Cloud API da plataforma e a configuração de outreach por tenant, com migration aplicável e dados iniciais para o tenant operacional atual.

## Contexto para o subagent

- Schema atual: `prisma/schema.prisma` (provider PostgreSQL, Prisma 6).
- `Tenant` já tem `uuid` (@unique) e `phone` (String? @unique).
- `TenantLead.messageId` já existe como `String?` — **não** transformar em FK.
- Não alterar models órfãos (`Session`, `Webhooks`, `Contacts`) nesta task.
- Baileys/captura fora de escopo.
- Convenção: `@@map` snake_case para tabelas; campos relation camelCase no model; `@map` para colunas snake_case quando já é o padrão do arquivo.
- Comandos típicos do repo: `npx prisma migrate dev` / `npx prisma generate` (não inventar scripts novos se não precisar).

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `prisma/schema.prisma` | editar |
| `prisma/migrations/<timestamp>_*/migration.sql` | criar |
| script seed/data (ex. `prisma/seed-outreach.ts` ou extensão pontual de migrate data) | criar |

---

## 1.1 — Adicionar models no schema

### O que fazer

Em `prisma/schema.prisma`, adicionar:

1. Enum (ou string discriminada) `WhatsappProvider` com valor `CLOUD_API` (deixar espaço mental para BAILEYS futuro, mas **não** implementar Baileys).

2. Model `WhatsappAccount`:
   - `id`, `provider` (CLOUD_API), `phoneNumberId`, `displayPhone?`, `tokenEnvKey` default `"WHATSAPP_TOKEN"`
   - `tenantId` Int? — `null` = conta da plataforma
   - `enabled` Boolean default true
   - timestamps + `@@map("whatsapp_accounts")`
   - Relation opcional com `Tenant` se `tenantId` setado

3. Model `TenantOutreachConfig`:
   - `tenantId` Int @unique + relation `Tenant`
   - `enabled` Boolean @default(false)
   - `costPerLead` Float
   - `cashbackOnReply` Float @default(0)
   - `outreachTemplateName` String
   - `notifyTenantTemplateName` String
   - `schedule` Json  // ex.: `{ "2": [18], "3": [18], "4": [13, 18] }` (dia JS → horas UTC)
   - `categories` Json  // string[]
   - timestamps + `@@map("tenant_outreach_configs")`

4. Em `Tenant`, adicionar relations inversas (`outreachConfig`, `whatsappAccounts?`).

### Critérios de aceite

- [ ] `schema.prisma` valida com `npx prisma validate`
- [ ] Models mapeiam tabelas snake_case
- [ ] `TenantLead.messageId` permanece String? sem FK

### Não fazer

- Não adicionar `PlatformUser`, `ScrapeJob`, nem tenantId em `Message`
- Não remover `Session`/`Webhooks`/`Contacts`

---

## 1.2 — Migration e client

### O que fazer

Gerar migration com Prisma alinhada ao schema. Rodar generate para atualizar `@prisma/client`.

### Critérios de aceite

- [ ] Pasta nova em `prisma/migrations/` com SQL de create table
- [ ] Client gera sem erro

### Não fazer

- Não editar migrations antigas já aplicadas
- Não usar `--skip-generate` se o restante do fluxo precisa do client

---

## 1.3 — Data seed da conta plataforma e tenant operacional

### O que fazer

Criar script idempotente (ou SQL na migration de data) que:

1. Upsert `WhatsappAccount` plataforma (`tenantId: null`, `phoneNumberId: "688645744332614"`, `tokenEnvKey: "WHATSAPP_TOKEN"`, `enabled: true`).
2. Localizar o tenant que hoje é o operacional do notifly (`id: 8` **se existir** no ambiente; caso não exista, documentar no script que o operador deve passar `TENANT_ID`).
3. Upsert `TenantOutreachConfig` com:
   - `enabled: true`
   - `costPerLead: 0.35`
   - `cashbackOnReply: 0`
   - `outreachTemplateName: "amigavel"`
   - `notifyTenantTemplateName: "lembrete_entrar_contato_cliente"`
   - `schedule`: mapa atual do cron em `apps/notifly/src/leads.service.ts` (`2:[18], 3:[18], 4:[13,18]`)
   - `categories`: lista ativa atual em `contactLeads` (Construtoras, Escritórios de advocacia, Clínicas médicas, Clínicas odontológicas, Consultórios, Estéticas, Consutorias — respeitar o array **não comentado** no arquivo no momento da implementação)

Outros tenants: configs opcionais `enabled: false` ou ausência de config (= inelegível).

### Critérios de aceite

- [ ] Reexecutar o script não duplica contas/configs
- [ ] Conta plataforma e config do tenant operacional ficam queryáveis via Prisma

### Não fazer

- Não hardcodar números de telefone de tenants no seed além do necessário
- Não habilitar outreach para todos os tenants

---

## Verificação do grupo

```bash
npx prisma validate
npx prisma migrate status
# após migrate + seed: query WhatsappAccount e TenantOutreachConfig
```

## Handoff para próxima task

Schema e dados base prontos. Task 2 pode resolver phoneNumberId/token; Task 3 pode ler configs no cron; Task 4 só precisa de Tenant.uuid/phone (já existentes).
