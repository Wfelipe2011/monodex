# Task 1 — Schema e migration

**Change:** `tenant-invite-and-self-password`
**Grupo:** 1 de 6
**Pré-requisitos:** nenhum
**Desbloqueia:** [task-02](./task-02-shared-token-curto-e-ttl.md), [task-03](./task-03-admin-emissao-listagem-e-revogacao.md), [task-04](./task-04-publico-preview-e-aceite.md), [task-05](./task-05-auth-troca-de-senha-propria.md)

## Objetivo do grupo

Prisma: enum `InvitePurpose` e tabela `invites` com hash do token, TTL, consumo e revogação, ligados ao tenant. Sem backfill.

## Contexto para o subagent

- Schema: `prisma/schema.prisma`.
- `Tenant` (~linha 11): adicionar `invites Invite[]`. Não remover relações existentes.
- `User.password` permanece `String` obrigatório. **Não** tornar opcional.
- `enum Roles` já tem `ADMIN`, `USER`, `SUPER_ADMIN` — não alterar.
- Migrations em `prisma/migrations/`. Padrão de nome: `YYYYMMDDHHMMSS_tenant_invite_and_self_password`.
- Não alterar apps nesta task.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `prisma/schema.prisma` | editar |
| `prisma/migrations/<timestamp>_tenant_invite_and_self_password/migration.sql` | criar |

---

## 1.1 — Enum e model Prisma

### O que fazer

Adicionar o enum (junto aos outros enums, perto de `Roles` ~linha 290):

```prisma
enum InvitePurpose {
  FIRST_ADMIN
  TENANT_USER
}
```

Adicionar o model (snake_case nos `@map`, igual ao resto do schema):

```prisma
model Invite {
  id              Int           @id @default(autoincrement())
  tenantId        Int           @map("tenant_id")
  tenant          Tenant        @relation(fields: [tenantId], references: [id])
  purpose         InvitePurpose
  tokenHash       String        @unique @map("token_hash")
  expiresAt       DateTime      @map("expires_at")
  consumedAt      DateTime?     @map("consumed_at")
  revokedAt       DateTime?     @map("revoked_at")
  createdByUserId Int?          @map("created_by_user_id")
  createdAt       DateTime      @default(now()) @map("created_at")
  updatedAt       DateTime      @updatedAt @map("updated_at")

  @@index([tenantId, purpose])
  @@map("invites")
}
```

Em `Tenant`, incluir `invites Invite[]`.

Não criar FK obrigatória de `createdByUserId` para `User` (auditoria frouxa; evitar cascade). Status (`PENDING`/`CONSUMED`/`REVOKED`/`EXPIRED`) é **derivado** na API, não é coluna.

### Critérios de aceite

- [ ] `InvitePurpose` tem exatamente `FIRST_ADMIN` e `TENANT_USER`
- [ ] `tokenHash` unique; `consumedAt` e `revokedAt` opcionais
- [ ] `Tenant.invites` existe
- [ ] `User.password` continua obrigatório
- [ ] `npx prisma validate` passa

### Não fazer

- Não adicionar e-mail/nome/username no `Invite`
- Não persistir o token em plaintext
- Não criar enum de status no banco

---

## 1.2 — Migration SQL

### O que fazer

Gerar migration (`npx prisma migrate dev --name tenant_invite_and_self_password` **ou** SQL manual no padrão das migrations existentes) incluindo:

1. `CREATE TYPE "InvitePurpose" AS ENUM ('FIRST_ADMIN', 'TENANT_USER');`
2. `CREATE TABLE "invites"` com as colunas mapeadas
3. Unique em `token_hash`
4. Index `(tenant_id, purpose)`
5. FK `tenant_id` → `tenants(id)`

Sem backfill. Sem `DROP` de tabelas existentes.

### Critérios de aceite

- [ ] Arquivo em `prisma/migrations/<timestamp>_tenant_invite_and_self_password/migration.sql`
- [ ] SQL cria enum + tabela + unique + index + FK
- [ ] `npx prisma validate` passa

### Não fazer

- Não editar migrations antigas
- Não alterar `users.password`

---

## Verificação do grupo

```bash
npx prisma validate
```

## Handoff para próxima task

Schema `Invite` pronto. Task 2 implementa geração/hash/TTL. Tasks 3–4 falam com `prisma.invite`. Task 5 não depende deste model, mas espera o grupo 1 no pipeline.
