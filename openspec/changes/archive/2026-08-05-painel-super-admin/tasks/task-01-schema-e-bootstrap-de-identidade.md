# Task 1 — Schema e bootstrap de identidade

**Change:** `painel-super-admin`
**Grupo:** 1 de 6
**Pré-requisitos:** nenhum
**Desbloqueia:** [Task 2](./task-02-fundacoes-do-modulo-admin-no-gym-ctrl.md) e demais grupos de API

## Objetivo do grupo

Schema com `SUPER_ADMIN` + `Tenant.active`, migration aplicada, e seed idempotente que permite login JWT de plataforma.

## Contexto para o subagent

- Schema: `prisma/schema.prisma` — enum `Roles` hoje só `ADMIN`/`USER`; model `Tenant` sem `active`.
- Auth login já existe: `apps/gym-ctrl/src/modules/auth.service.ts` usa `bcrypt.compare` e `jwt.sign` com payload `UserToken` (`libs/contracts/user-token.ts`).
- Referência de seed idempotente: `prisma/seed-outreach.ts` (`npx ts-node prisma/seed-outreach.ts`).
- Não alterar notifly/captura neste grupo.
- Decisão de design: tenant plataforma name **`Platform`**; user com `roles: [SUPER_ADMIN]`.
- Env: `PLATFORM_ADMIN_EMAIL`, `PLATFORM_ADMIN_PASSWORD` (obrigatórios em produção; defaults só se `NODE_ENV=development` e documentados).

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `prisma/schema.prisma` | editar |
| `prisma/migrations/<timestamp>_add_super_admin_and_tenant_active/migration.sql` | criar |
| `prisma/seed-platform-admin.ts` | criar |
| `package.json` (script opcional `seed:platform-admin`) | editar opcional |

---

## 1.1 — Schema: SUPER_ADMIN + Tenant.active

### O que fazer

Em `prisma/schema.prisma`:

1. Em `enum Roles`, adicionar `SUPER_ADMIN`.
2. Em `model Tenant`, adicionar:
   ```prisma
   active Boolean @default(true)
   ```
   Mapear se o projeto usar `@map` em outros booleanos (hoje `active` pode ficar sem map, camelCase na coluna, ou `@map("active")` — preferir coluna `active`).

### Critérios de aceite

- [x] `Roles` contém `ADMIN`, `USER`, `SUPER_ADMIN`
- [x] `Tenant` tem `active Boolean @default(true)`

### Não fazer

- Não criar model `PlatformUser`
- Não remover `@unique` de `User.email` nesta change

---

## 1.2 — Migration Prisma

### O que fazer

```bash
npx prisma migrate dev --name add_super_admin_and_tenant_active
```

(Se o ambiente for só deploy: `prisma migrate dev` local ou criar SQL manual alinhado ao schema.)

Garantir que a migration:
- Altera o enum PostgreSQL `Roles` adicionando `SUPER_ADMIN`
- Adiciona coluna `active` em `tenants` com default `true`

Rodar `npx prisma generate` se necessário.

### Critérios de aceite

- [x] Pasta de migration criada sob `prisma/migrations/`
- [x] Client Prisma gera tipos com `Roles.SUPER_ADMIN` e `Tenant.active`

### Não fazer

- Não editar migrations antigas já aplicadas
- Não apontar seed contra DB de produção sem confirmação humana

---

## 1.3 — Seed idempotente platform admin

### O que fazer

Criar `prisma/seed-platform-admin.ts` no estilo de `seed-outreach.ts`:

1. Upsert/find tenant onde `name === 'Platform'` (criar se não existir; `phone` pode ser null; `active: true`).
2. Resolver email/senha de `process.env.PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD`.
3. Se user com esse email não existe: `bcrypt.hash(password, 10)` (mesmo uso que o ecossistema bcrypt do projeto), criar user com `roles: [SUPER_ADMIN]`, `tenantId` do Platform, `username` derivado ou env.
4. Se existe: não duplicar; opcionalmente não resetar senha em re-run (mais seguro).
5. Log claro do que foi feito.
6. Documentar uso no header do arquivo: `npx ts-node prisma/seed-platform-admin.ts`

Opcional: script npm `seed:platform-admin`.

### Critérios de aceite

- [x] Primeira execução cria tenant + user
- [x] Segunda execução não duplica
- [x] Password no DB é hash bcrypt, não plaintext

### Não fazer

- Não reutilizar/overwrite `seed-outreach.ts` para isso (manter responsabilidades separadas)
- Não logar a senha em plaintext

---

## 1.4 — Verificar login JWT

### O que fazer

Com gym rodando (`npm run gym:dev` / porta `GYM_PORT`):

```bash
curl -s -X POST http://localhost:$GYM_PORT/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"<PLATFORM_ADMIN_EMAIL>","password":"<PLATFORM_ADMIN_PASSWORD>"}'
```

Decodificar JWT (payload) e confirmar `roles` inclui `SUPER_ADMIN` e `tenantId` do tenant Platform.

### Critérios de aceite

- [x] HTTP 200 com `{ token }`
- [x] Payload JWT contém `SUPER_ADMIN`

### Não fazer

- Não alterar contrato de `LoginInput`/`LoginOutput` sem necessidade

---

## Verificação do grupo

- Migration aplica limpa; seed roda 2x; login funciona.

## Handoff para próxima task

Grupo 2 assume `Roles.SUPER_ADMIN` no client Prisma e existência de um user que passa no login. Endpoints `/admin` ainda não existem.
