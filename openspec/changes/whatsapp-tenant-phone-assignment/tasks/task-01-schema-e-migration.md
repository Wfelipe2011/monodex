# Task 1 — Schema e migration

**Change:** `whatsapp-tenant-phone-assignment`
**Grupo:** 1 de 8
**Pré-requisitos:** nenhum
**Desbloqueia:** [task-02](./task-02-resolver-de-credenciais.md), [task-03](./task-03-admin-whatsapp-accounts.md), [task-04](./task-04-admin-amarracao-no-outreach-config.md)

## Objetivo do grupo

Schema Prisma e migration: vários números no mesmo WABA, um default explícito, e FK exclusiva opcional do tenant para um número dedicado.

## Contexto para o subagent

- Schema: `prisma/schema.prisma`. `WhatsappAccount` (por volta da linha 296) tem `phoneNumberId`, `wabaId`, `tokenEnvKey`, `tenantId Int?` — **não** use `tenantId` como amarração; continue null.
- `TenantOutreachConfig` (por volta da linha 338) é 1:1 com `Tenant` via `tenantId @unique`.
- `Tenant` já tem `whatsappAccounts WhatsappAccount[]` — deixe como está (relação pelo campo `tenantId` da conta, não pela nova FK).
- Migrations em `prisma/migrations/`. Última relevante de contas: `20260805021528_add_whatsapp_account_and_tenant_outreach_config`.
- Prisma não gera unique parcial; o índice “só uma default” entra em SQL cru na migration.
- Não alterar apps nesta task.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `prisma/schema.prisma` | editar |
| `prisma/migrations/<timestamp>_whatsapp_tenant_phone_assignment/migration.sql` | criar |

---

## 1.1 — Campos Prisma

### O que fazer

Em `WhatsappAccount`:

- `isDefault Boolean @default(false) @map("is_default")`
- `phoneNumberId` passar a `@unique` (ou `@@unique([phoneNumberId])`)
- Relation inversa 1:1 opcional com a config, ex. `assignedOutreachConfig TenantOutreachConfig?`
- `tenantId` permanece opcional; **não** remover

Em `TenantOutreachConfig`:

```prisma
whatsappAccountId Int? @unique @map("whatsapp_account_id")
whatsappAccount   WhatsappAccount? @relation(fields: [whatsappAccountId], references: [id], onDelete: Restrict)
```

`@unique` na FK: vários `null` (default compartilhado) e no máximo um tenant por número dedicado.

### Critérios de aceite

- [ ] `isDefault` mapeado para `is_default`
- [ ] `phoneNumberId` unique
- [ ] `whatsappAccountId` nullable + unique + Restrict
- [ ] `npx prisma validate` passa

### Não fazer

- Não preencher `WhatsappAccount.tenantId` como mecanismo de produto
- Não criar tabela `WhatsappWaba`
- Não mudar templates / grants

---

## 1.2 — Migration e backfill

### O que fazer

Gerar migration (`npx prisma migrate dev --name whatsapp_tenant_phone_assignment` ou criar SQL equivalente no padrão das migrations existentes).

SQL obrigatório além do que o Prisma emitir:

1. `ALTER` / `ADD COLUMN is_default boolean NOT NULL DEFAULT false`
2. Unique em `phone_number_id` (se ainda não existir)
3. Coluna `whatsapp_account_id` em `tenant_outreach_configs` nullable + unique + FK Restrict
4. Unique parcial:

```sql
CREATE UNIQUE INDEX whatsapp_accounts_one_default
  ON whatsapp_accounts (is_default)
  WHERE is_default = true;
```

5. Backfill **antes** do índice, se ainda não houver default:

```sql
UPDATE whatsapp_accounts
SET is_default = true
WHERE id = (
  SELECT id FROM whatsapp_accounts
  WHERE tenant_id IS NULL AND enabled = true
  ORDER BY id ASC
  LIMIT 1
)
AND NOT EXISTS (
  SELECT 1 FROM whatsapp_accounts WHERE is_default = true
);
```

Regenerar client (`npx prisma generate`).

### Critérios de aceite

- [ ] Migration aplica em banco limpo e em banco que já tem a conta seed `phoneNumberId` `1292251013966333`
- [ ] Após migrate, existe exatamente uma row `is_default = true` se havia ao menos uma conta plataforma enabled
- [ ] `npx prisma generate` ok

### Não fazer

- Não dropar `whatsapp_accounts` nem templates
- Não setar `whatsapp_account_id` nos tenants existentes (ficam null = default)

---

## Verificação do grupo

`npx prisma validate` e inspecionar o SQL: unique parcial + backfill presentes.

## Handoff para próxima task

Resolver (grupo 2) pode ler `isDefault` e `TenantOutreachConfig.whatsappAccountId`. APIs ainda não expõem os campos.
