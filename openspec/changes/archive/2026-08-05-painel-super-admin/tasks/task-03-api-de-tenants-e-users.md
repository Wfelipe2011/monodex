# Task 3 — API de tenants e users

**Change:** `painel-super-admin`
**Grupo:** 3 de 6
**Pré-requisitos:** [Task 2](./task-02-fundacoes-do-modulo-admin-no-gym-ctrl.md)
**Desbloqueia:** [Task 4](./task-04-api-de-coins.md), [Task 5](./task-05-api-de-config-de-plataforma-outreach-whatsapp.md)

## Objetivo do grupo

CRUD de tenants (com `active`) e gestão de users de tenant (criar admin, reset password), sem promover `SUPER_ADMIN`.

## Contexto para o subagent

- Models: `Tenant`, `User` em `prisma/schema.prisma`.
- `User.password` é string hashed; login em `auth.service.ts` usa `bcrypt.compare`.
- `CreateUserDto` órfão em `apps/gym-ctrl/src/dtos/create-user.dto.ts` — pode evoluir ou criar DTOs admin novos com `class-validator` + `@ApiProperty`.
- Email tem `@unique` global — colisões retornam erro Prisma; mapear para 400/409.
- Design: não permitir `SUPER_ADMIN` via endpoints deste grupo.
- Guards já no controller via Task 2.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/gym-ctrl/src/modules/admin/tenants.controller.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/tenants.service.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/users.controller.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/users.service.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/dto/*.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/admin.module.ts` | editar |

---

## 3.1 — CRUD Tenants

### O que fazer

Endpoints:

| Método | Path |
|--------|------|
| `GET` | `/admin/tenants` |
| `POST` | `/admin/tenants` body: `{ name: string, phone?: string, active?: boolean }` |
| `GET` | `/admin/tenants/:id` |
| `PATCH` | `/admin/tenants/:id` body: `{ name?, phone?, active? }` |

- `uuid` gerado pelo Prisma; não aceitar override no create.
- 404 se id inexistente.
- Query opcional `?active=true|false` no list é nice-to-have.

### Critérios de aceite

- [ ] Criar tenant sem SQL
- [ ] Patch `active: false` persiste
- [ ] List retorna campos `id, name, phone, uuid, active`

### Não fazer

- Não hard-delete tenants
- Não alterar welcome/notifly

---

## 3.2 — Users do tenant

### O que fazer

| Método | Path |
|--------|------|
| `GET` | `/admin/tenants/:tenantId/users` |
| `POST` | `/admin/tenants/:tenantId/users` body: `{ name, username, email, password, roles? }` |
| `PATCH` | `/admin/tenants/:tenantId/users/:userId` body: `{ name?, roles? }` |
| `POST` | `/admin/tenants/:tenantId/users/:userId/reset-password` body: `{ password }` |

- Default `roles: [ADMIN]` no create.
- `bcrypt.hash(password, 10)` (ou rounds já usados no projeto) no create e reset.
- Response: omitir `password`.
- Validar que `user.tenantId === tenantId` no patch/reset.

### Critérios de aceite

- [ ] User criado autentica em `/auth/login`
- [ ] Reset password invalida senha antiga (login só com a nova)
- [ ] GET users não inclui hash

### Não fazer

- Não criar endpoint de delete user no MVP

---

## 3.3 — Rejeitar SUPER_ADMIN em tenant users

### O que fazer

Se `roles` no body contiver `SUPER_ADMIN` → `BadRequestException`.

Aplicar em create e patch.

### Critérios de aceite

- [ ] POST/PATCH com `SUPER_ADMIN` → 400

### Não fazer

- Não permitir “bypass” via Prisma em scripts acidentais neste controller

---

## 3.4 — Hash e responses

### O que fazer

- Confirmar hash em todas as escritas de senha.
- Usar `class-transformer` `@Exclude()` ou `select` Prisma explícito sem `password`.
- DTOs Swagger documentados.

### Critérios de aceite

- [ ] Nenhum response JSON de user contém campo `password`
- [ ] Senha no DB ≠ plaintext

### Não fazer

- Não logar senhas

---

## Verificação do grupo

Swagger: criar tenant → criar admin → login como admin do tenant (não acessa `/admin`) → login super admin lista users.

## Handoff para próxima task

Task 4 precisa de `tenantId` + `userId` válidos para credit/debit.
