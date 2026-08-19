# Task 3 — Admin — emissão, listagem e revogação

**Change:** `tenant-invite-and-self-password`
**Grupo:** 3 de 6
**Pré-requisitos:** [task-01](./task-01-schema-e-migration.md), [task-02](./task-02-shared-token-curto-e-ttl.md)
**Desbloqueia:** [task-06](./task-06-postman-front-integration-e-verificacao.md)

## Objetivo do grupo

Super Admin emite/lista/revoga convite `FIRST_ADMIN`. Admin do tenant emite/lista/revoga convite `TENANT_USER`. Raw token só no POST de criação. Create-com-senha do primeiro user revoga `FIRST_ADMIN` pendentes.

## Contexto para o subagent

- Padrão dual controller: `apps/gym-ctrl/src/modules/admin/users.controller.ts` (`UsersController` platform + `TenantUsersController`).
- Guards tenant: `TenantScopeGuard` + `TenantActiveGuard` (já registrados em `AdminModule`).
- Super Admin write em recurso tenant-owned: **não** usar `assertSuperAdminTenantWrite` / janela de 30 min. Emissão de `TENANT_USER` é sempre 403 para `SUPER_ADMIN`, igual `UsersService.createByTenantAdmin`.
- `UsersService.create` (`apps/gym-ctrl/src/modules/admin/users.service.ts`): primeiro user com senha; se `count > 0` → 403. Depois (ou na mesma transaction) revogar invites `FIRST_ADMIN` com `consumedAt` e `revokedAt` null daquele tenant (`revokedAt = now`).
- Helpers: `@core/shared/invite-token`.
- Env ainda pode ser lido via `ConfigService` com default 8 se Joi (task 6) ainda não estiver; preferir `ConfigService.get('INVITE_TTL_HOURS')` com fallback `DEFAULT_INVITE_TTL_HOURS`.
- `INVITE_PUBLIC_BASE_URL`: trim `/` final; `url = base ? `${base}/convite/${raw}` : `/convite/${raw}``.
- Registrar service + controllers em `apps/gym-ctrl/src/modules/admin/admin.module.ts`.
- Select de user **nunca** inclui `password` (já é o padrão em `userSelect`).
- Status derivado (prioridade): `consumedAt` → `CONSUMED`; senão `revokedAt` → `REVOKED`; senão `expiresAt <= now` → `EXPIRED`; senão `PENDING`.
- Não implementar `/public/*` nesta task (task 4).

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/gym-ctrl/src/modules/admin/invites.service.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/invites.controller.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/invites.service.spec.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/dto/invite-response.dto.ts` | criar (Swagger; opcional se preferir tipos inline) |
| `apps/gym-ctrl/src/modules/admin/admin.module.ts` | editar |
| `apps/gym-ctrl/src/modules/admin/users.service.ts` | editar (revogar FIRST_ADMIN no create) |

---

## 3.1 — Platform FIRST_ADMIN

### O que fazer

Controller `@RolesAuth(Roles.SUPER_ADMIN)` `@Controller('platform/tenants/:tenantId/invites')` tag `Platform — Tenant Invites`.

| Método | Path | Comportamento |
|--------|------|----------------|
| `POST` | `/` | Body vazio. Tenant 404 se não existe. Se `user.count > 0` → **409**. Revogar outros `FIRST_ADMIN` PENDING daquele tenant. Criar invite `purpose=FIRST_ADMIN`, `tokenHash`, `expiresAt`, `createdByUserId` do JWT. Response **201**: `{ id, purpose, token, url, expiresAt }` |
| `GET` | `/` | Lista do tenant, **sem** `token`/`tokenHash`. Incluir `status` derivado |
| `POST` | `/:inviteId/revoke` | Só se do tenant e ainda PENDING; set `revokedAt`. 404 se não achar. Idempotente 409/404 se já consumido/revogado (escolher 409 para não-PENDING) |

`POST` create **não** exige DTO de identidade (nome/email/senha). Whitelist ValidationPipe já no padrão dos outros controllers.

### Critérios de aceite

- [ ] POST sem users no tenant → 201 com `token` curto e `purpose` `FIRST_ADMIN`
- [ ] POST com users existentes → 409
- [ ] Segundo POST revoga o pendente anterior
- [ ] GET não contém `token` nem `tokenHash`
- [ ] Swagger tag `Platform — Tenant Invites`

### Não fazer

- Não aceitar `email`/`password` no body de emissão
- Não criar o `User` neste POST
- Não permitir `TENANT_USER` neste prefixo

---

## 3.2 — Tenant TENANT_USER

### O que fazer

Segundo controller: `@RolesAuth(Roles.ADMIN, Roles.SUPER_ADMIN)` `@UseGuards(TenantScopeGuard, TenantActiveGuard)` `@Controller('tenant/:tenantId/invites')` tag `Tenant — Invites`.

`POST` e `revoke`: se `req.user.roles` inclui `SUPER_ADMIN` → `ForbiddenException` (`Acesso não permitido`), **antes** de persistir. GET pode permanecer para Super Admin (leitura operacional), alinhado à lista de users.

`POST` cria `purpose=TENANT_USER`. Vários PENDING permitidos (não revogar os anteriores). Tenant inativo → 403 pelo `TenantActiveGuard`.

Response 201 igual ao platform (`token` uma vez).

### Critérios de aceite

- [ ] Admin do tenant → 201 `TENANT_USER`
- [ ] Super Admin POST/revoke → 403
- [ ] Dois POSTs seguidos deixam dois PENDING
- [ ] Tenant `active=false` POST → 403
- [ ] Admin de outro tenant → 403 (`TenantScopeGuard`)

### Não fazer

- Não criar user `ADMIN` neste convite
- Não usar bootstrap window para liberar Super Admin

---

## 3.3 — Revogar no create-com-senha

### O que fazer

Em `UsersService.create` (primeiro user platform), após persistir o user com sucesso (ou na mesma `$transaction`):

```ts
await prisma.invite.updateMany({
  where: {
    tenantId,
    purpose: 'FIRST_ADMIN',
    consumedAt: null,
    revokedAt: null,
  },
  data: { revokedAt: new Date() },
});
```

Não mexer em `TENANT_USER`. Não alterar `createByTenantAdmin`.

### Critérios de aceite

- [ ] Depois de `POST /platform/tenants/:id/users` com senha, convites `FIRST_ADMIN` pendentes daquele tenant ficam `REVOKED`
- [ ] Create-com-senha continua 403 se já existe user

### Não fazer

- Não remover o endpoint de create-com-senha
- Não revogar convites de outros tenants

---

## 3.4 — Testes do service

### O que fazer

`invites.service.spec.ts` com Prisma mockado (padrão `conversations.service.spec.ts` / `ops.service.spec.ts`: objeto `prisma` com `jest.fn()`).

Cobrir:

- issue FIRST_ADMIN quando count users = 0
- issue FIRST_ADMIN quando count > 0 → ConflictException/409
- reissue marca o anterior com `revokedAt`
- list não devolve `tokenHash` no mapper de response
- issue TENANT_USER com roles SUPER_ADMIN → ForbiddenException
- vários TENANT_USER pending

Também um teste de `UsersService.create` revogando invites **ou** extrair a revogação para um método `InvitesService.revokePendingFirstAdmin(tenantId)` chamado pelo `UsersService` (injetar `InvitesService` em `UsersService` — cuidado com ciclo: melhor método no `InvitesService` e `UsersService` chama, **ou** `updateMany` direto no `UsersService` sem injeção cruzada). Preferir `updateMany` no `UsersService` para não criar ciclo AdminModule.

### Critérios de aceite

- [ ] `npx jest apps/gym-ctrl/src/modules/admin/invites.service.spec.ts` passa
- [ ] Caso 409 / 403 / reissue cobertos

### Não fazer

- Não testar aceite público aqui (task 4)
- Não bater em banco real

---

## Verificação do grupo

```bash
npx jest apps/gym-ctrl/src/modules/admin/invites.service.spec.ts
```

Swagger: tags novas visíveis após boot (`generate-metadata` já é watch no `gym:dev`).

## Handoff para próxima task

`InvitesService` sabe criar/listar/revogar e resolver status. Task 4 adiciona lookup por `tokenHash`, preview e accept transacional. Não exportar raw token em GET.
