# Task 2 — Guards e helpers de autorização

**Change:** `tenant-admin-rbac-and-send-policies`
**Grupo:** 2 de 8
**Pré-requisitos:** [Task 1](./task-01-schema-e-migration.md)
**Desbloqueia:** [Task 3](./task-03-prefixo-platform-e-split-de-campos-super-admin.md), [Task 4](./task-04-superficie-tenant-operacional.md)

## Objetivo do grupo

Centralizar janela de 30 min, escopo de tenant, lock `active` e funções puras de política de cidade/exclusão de telefone, com testes.

## Contexto para o subagent

- `RolesGuard` atual: `libs/guard/roles.guard.ts` — só checa `user.roles` vs metadata.
- Decorator: `libs/decorators/roles.decorator.ts` (`ROLES_KEY`).
- JWT payload: `libs/contracts/user-token.ts` (`userId`, `tenantId`, `roles`).
- Auth global: `apps/gym-ctrl/src/modules/auth.module.ts` registra `AuthGuard` + `RolesGuard` via `APP_GUARD`.
- Nest: guards de controller via `@UseGuards`. Não substituir `RolesGuard` global.
- Specs: `specs/tenant-operator-api/spec.md`, `specs/tenant-send-policies/spec.md`.
- Design D2/D3/D5.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `libs/shared/bootstrap-window.ts` | criar |
| `libs/shared/bootstrap-window.spec.ts` | criar |
| `libs/shared/send-policy.ts` | criar |
| `libs/shared/send-policy.spec.ts` | criar |
| `libs/guard/tenant-scope.guard.ts` | criar |
| `libs/guard/tenant-active.guard.ts` | criar |
| `libs/guard/bootstrap-write.ts` (helper throw 403) | criar |

---

## 2.1 — Constante e helper de janela

### O que fazer

```ts
export const BOOTSTRAP_EDIT_WINDOW_MS = 30 * 60 * 1000;

export function isWithinBootstrapWindow(
  createdAt: Date,
  nowMs: number = Date.now(),
): boolean {
  return nowMs - createdAt.getTime() < BOOTSTRAP_EDIT_WINDOW_MS;
}
```

`canSuperAdminWriteAdminFields({ exists, createdAt })`: `!exists` → true (create); senão `isWithinBootstrapWindow`.

### Critérios de aceite

- [ ] 29 min 59 s → true; 30 min → false
- [ ] Recurso inexistente → create permitido

### Não fazer

- Não persistir `bootstrapUntil` no banco

---

## 2.2 — TenantScopeGuard

### O que fazer

Ler `request.params.tenantId` (ParseInt) e `request.user` (`UserToken`).

- Sem user → deixar `AuthGuard` tratar (não duplicar 401 se já rodou).
- Se `user.roles` inclui `SUPER_ADMIN` → `true`.
- Senão: `Number(tenantId) === user.tenantId` senão `ForbiddenException('Acesso não permitido')`.

Aplicação fica nos controllers `/tenant/:tenantId` (grupo 4). Este grupo só entrega a classe.

### Critérios de aceite

- [ ] ADMIN tenant 4 em `:tenantId=9` → 403
- [ ] SUPER_ADMIN qualquer tenantId → passa

### Não fazer

- Não usar `tenantId` do JWT para filtrar `/platform`

---

## 2.3 — TenantActiveGuard

### O que fazer

Para métodos HTTP não GET/HEAD/OPTIONS em rotas tenant: carregar `Tenant.active` do `params.tenantId`. Se `false`, `ForbiddenException`. GET sempre `true`. Super Admin em `/platform` não usa este guard.

Injetar `PrismaService` (`@core/infra/prisma/prisma.service`).

### Critérios de aceite

- [ ] `active=false` + POST → 403
- [ ] `active=false` + GET → passa o guard

### Não fazer

- Não misturar com `outreachConfig.enabled`

---

## 2.4 — Helper de pontapé Super Admin

### O que fazer

Função usada pelos services (grupos 3–4), não necessariamente um Guard Nest:

`assertSuperAdminTenantWrite({ roles, resourceCreatedAt | null, isPlatformField })`

- Se caller é ADMIN → não usar este helper (eles escrevem campos de Admin sempre, se scope/active ok).
- Se SUPER_ADMIN e campo/plataforma → ok.
- Se SUPER_ADMIN e campo Admin e `resourceCreatedAt == null` → ok (create).
- Se SUPER_ADMIN e campo Admin e fora da janela → `ForbiddenException`.

### Critérios de aceite

- [ ] Helper lança 403 fora da janela para campos Admin
- [ ] Não lança para `costPerLead`

### Não fazer

- Não permitir Super Admin criar 2º user (isso é regra no `UsersService`, grupo 3)

---

## 2.5 — Testes de política (funções puras)

### O que fazer

Em `libs/shared/send-policy.ts`:

- `assertCityPolicyXor(allowed: number[], denied: number[])` throw se ambos length > 0.
- `cityAllowed(cityId, allowed, denied)`: empty both → true; allow non-empty → `allowed.includes`; else `!denied.includes`.
- `mergeExcludedPhones({ own, pairwise, allOthersIfRespectAll, exclusiveTenants })` → `Set<string>`.

Testes em `*.spec.ts` no estilo de `apps/notifly/src/premium-mix.spec.ts` (jest já no repo).

### Critérios de aceite

- [ ] XOR cobre ambos não-vazios
- [ ] allow `[1]` recusa city 2
- [ ] união de sets não duplica phones

### Não fazer

- Não chamar Prisma nos testes destas funções

---

## Verificação do grupo

`npx jest libs/shared/bootstrap-window.spec.ts libs/shared/send-policy.spec.ts` (ou o script de test do package.json).

## Handoff para próxima task

Guards/helpers importáveis. Grupo 3 move `/platform`; grupo 4 aplica guards nos controllers `/tenant`.
