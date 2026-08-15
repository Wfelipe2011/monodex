# Task 1 — Schema e migration

**Change:** `outreach-contact-text`
**Grupo:** 1 de 4
**Pré-requisitos:** nenhum
**Desbloqueia:** [2](./task-02-admin-outreach-contact-text.md), [3](./task-03-notifly-parametro-body-do-template.md)

## Objetivo do grupo

Adicionar a coluna persistida do texto de contato em `TenantOutreachConfig` com migration segura para rows existentes.

## Contexto para o subagent

- Schema: `prisma/schema.prisma` (PostgreSQL). Convenção: `@map` snake_case; model já em `@@map("tenant_outreach_configs")` (~linha 288).
- Campos atuais: `enabled`, `costPerLead`, `cashbackOnReply`, `outreachTemplateName`, `notifyTenantTemplateName`, `schedule`, `categories`, `leadsPerRun`, `headerImageUrl`, `sendIntervalSeconds`.
- Não alterar Lead, ScrapeTarget, WhatsappAccount.
- Comandos: `npx prisma validate`, `npx prisma migrate dev --name outreach_contact_text`, `npx prisma generate`.
- Pasta de migrations: `prisma/migrations/`.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `prisma/schema.prisma` | editar |
| `prisma/migrations/<timestamp>_outreach_contact_text/migration.sql` | criar |

---

## 1.1 — Campo no Prisma

### O que fazer

Em `model TenantOutreachConfig` adicionar:

```prisma
outreachContactText String @map("outreach_contact_text")
```

Sem `@default` no schema (a API PUT sempre envia o valor). Não tornar opcional (`String?`).

### Critérios de aceite

- [ ] Campo existe no model com `@map("outreach_contact_text")`
- [ ] `npx prisma validate` passa

### Não fazer

- Não criar array / JSON de contatos
- Não adicionar fallback de env no schema

---

## 1.2 — Migration

### O que fazer

SQL equivalente:

```sql
ALTER TABLE "tenant_outreach_configs"
ADD COLUMN "outreach_contact_text" TEXT NOT NULL DEFAULT '';
```

O `DEFAULT ''` é só para backfill; rows enabled precisam de PATCH operacional depois. Gerar o client.

### Critérios de aceite

- [ ] Migration aplica em banco com configs existentes sem erro
- [ ] Client Prisma inclui `outreachContactText`

### Não fazer

- Não apagar rows de outreach
- Não backfill com o nome do Gladson em todos os tenants

---

## Verificação do grupo

`npx prisma validate` e coluna visível no SQL gerado.

## Handoff para próxima task

Admin e Notifly podem rodar em paralelo: o campo existe no client; valores existentes podem ser `''`.
