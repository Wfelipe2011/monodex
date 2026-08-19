# Task 4 — Público — preview e aceite

**Change:** `tenant-invite-and-self-password`
**Grupo:** 4 de 6
**Pré-requisitos:** [task-01](./task-01-schema-e-migration.md), [task-02](./task-02-shared-token-curto-e-ttl.md), [task-03](./task-03-admin-emissao-listagem-e-revogacao.md)
**Desbloqueia:** [task-06](./task-06-postman-front-integration-e-verificacao.md)

## Objetivo do grupo

Rotas `@Public()` de preview e aceite. User nasce no aceite (ADMIN ou USER). JWT no mesmo contrato do login. Token morto → 404 genérico. Unique → 409 sem consumir.

## Contexto para o subagent

- `@Public()`: `libs/decorators/public.decorator.ts`. `AuthGuard` ignora JWT se a metadata estiver no handler. **Não** colocar `@RolesAuth` nestas rotas — `RolesGuard` lê `user.roles` e quebra sem JWT (`apps/gym-ctrl/src/modules/auth.controller.ts` é o exemplo).
- Login JWT: `apps/gym-ctrl/src/modules/auth.service.ts` (`jwt.sign` com `UserToken`: `id`, `userName`, `roles`, `tenantId`, `userId`, `expiresIn: '1d'`, secret `JWT_SECRET`). Extrair `issueJwt(user)` (ou equivalente) em `AuthService` e reutilizar no aceite. Exportar `AuthService` em `AuthModule` (`exports: [AuthService]`) e `imports: [AuthModule]` em `AdminModule` — **não** o contrário (ciclo).
- Hash: `hashInviteToken` da task 2. Lookup `prisma.invite.findUnique({ where: { tokenHash } })`.
- Create user: espelhar `UsersService.create` — `bcrypt.hash(..., 10)`, `email.toLowerCase()`, `select` sem password. Roles: `FIRST_ADMIN` → `[Roles.ADMIN]`; `TENANT_USER` → `[Roles.USER]`.
- Unique: `UsersService` privado `rethrowUnique` → `ConflictException`. Reusar a mesma lógica (P2002).
- Transação: `prisma.$transaction` cria user + `invite.update` `consumedAt`. Se unique falhar, rollback (invite permanece PENDING).
- `FIRST_ADMIN` + `user.count > 0` → 409 (não criar). Marcar o invite revogado nesse caso é aceitável (já não deveria ser aceito).
- Tenant `active=false` no aceite → 403.
- Rate limit in-memory por IP nos dois endpoints (ex. 20 hits / 15 min). Sem pacote novo. Falha de limite → 429. IP de `req.ip` / `x-forwarded-for` primeiro hop.
- DTO accept: `name`, `username`, `email`, `password` com os mesmos validators de `CreateTenantUserDto` (`MinLength(6)` na senha). Sem `roles` no body.
- Controller pode viver em `apps/gym-ctrl/src/modules/admin/public-invites.controller.ts` `@Controller('public/invites')`.

404 genérico: `NotFoundException('Convite não encontrado')` para unknown, expirado, revogado, consumido. Não enumerar o motivo.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/gym-ctrl/src/modules/admin/public-invites.controller.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/dto/accept-invite.dto.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/invites.service.ts` | editar (preview + accept) |
| `apps/gym-ctrl/src/modules/admin/invites.service.spec.ts` | editar |
| `apps/gym-ctrl/src/modules/auth.service.ts` | editar (`issueJwt`) |
| `apps/gym-ctrl/src/modules/auth.module.ts` | editar (`exports`) |
| `apps/gym-ctrl/src/modules/admin/admin.module.ts` | editar (import AuthModule + public controller) |

---

## 4.1 — Preview e accept

### O que fazer

```
GET  /public/invites/:token
→ 200 { purpose, tenantName, expiresAt }

POST /public/invites/:token/accept
body { name, username, email, password }
→ 201 { token }   // LoginOutput
```

`token` do path é o plaintext de 8 chars (não o hash).

Preview: carregar invite PENDING não expirado; incluir `tenant.name`. Não devolver `tenantId` se quiser mínimo; **pode** devolver `tenantId` para o front montar home — se devolver, documentar no Swagger. Preferir incluir `tenantId` (útil no JWT decode de qualquer forma após accept).

Accept:

1. Rate limit
2. Resolver invite (404 se morto)
3. Tenant inativo → 403
4. `FIRST_ADMIN` e já há users → 409
5. Transaction: create user + consume
6. `issueJwt` do user criado
7. Não logar o token de convite nem a senha (`AuthGuard` hoje loga Bearer — não adicionar log do invite token)

### Critérios de aceite

- [ ] GET sem Authorization não retorna 401
- [ ] POST accept `FIRST_ADMIN` cria `ADMIN` e devolve JWT
- [ ] POST accept `TENANT_USER` cria `USER` (sem `ADMIN`/`SUPER_ADMIN`) e devolve JWT
- [ ] Swagger tag `Public — Invites`
- [ ] `@Public()` nos dois handlers

### Não fazer

- Não exigir Bearer
- Não aceitar `roles` no body
- Não criar segundo Admin via `TENANT_USER`

---

## 4.2 — Rate limit, 404, transação, 409

### O que fazer

Map in-memory `ip → timestamps[]` (módulo do service). Limpar janela deslizante. Aplicar em preview **e** accept.

Unique e-mail/username: 409, invite `consumedAt` continua null (assert na transaction rollback).

Token expirado/revogado/consumido/unknown: 404 mesma mensagem.

### Critérios de aceite

- [ ] 409 de e-mail duplicado não seta `consumedAt`
- [ ] Token expirado → 404 (não 410, para não enumerar)
- [ ] Rate limit excessivo → 429

### Não fazer

- Não introduzir Redis ou `@nestjs/throttler`
- Não devolver stack/Prisma meta ao cliente

---

## 4.3 — Testes de aceite

### O que fazer

Estender `invites.service.spec.ts`:

- accept FIRST_ADMIN → prisma.user.create com `roles: [ADMIN]`, invite `consumedAt` setado, jwt chamado
- accept TENANT_USER → `roles: [USER]`
- accept FIRST_ADMIN com count>0 → 409, sem create
- preview/accept hash lookup miss → NotFoundException
- unique P2002 → ConflictException e sem update de consumedAt (simular throw dentro da transaction)

`npx jest apps/gym-ctrl/src/modules/admin/invites.service.spec.ts`

### Critérios de aceite

- [ ] Cenários FIRST_ADMIN vs TENANT_USER vs token morto vs already-has-user cobertos
- [ ] Jest passa

### Não fazer

- Não e2e HTTP obrigatório nesta task (Postman é task 6)

---

## Verificação do grupo

```bash
npx jest apps/gym-ctrl/src/modules/admin/invites.service.spec.ts
```

## Handoff para próxima task

Front pode `GET` + `POST` `/public/invites/:token` sem login. JWT do aceite entra nas rotas `/tenant` como qualquer login. Task 5 é independente (senha autenticada). Task 6 documenta o fluxo completo.
