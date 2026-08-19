# Task 5 — Auth — troca de senha própria

**Change:** `tenant-invite-and-self-password`
**Grupo:** 5 de 6
**Pré-requisitos:** [task-01](./task-01-schema-e-migration.md)
**Desbloqueia:** [task-06](./task-06-postman-front-integration-e-verificacao.md)

## Objetivo do grupo

Qualquer usuário autenticado altera a **própria** senha informando a atual. Super Admin não aprova. Endpoint de reset de colega permanece.

## Contexto para o subagent

- `apps/gym-ctrl/src/modules/auth.controller.ts`: tag `Autenticação`, `@Controller('auth')`. Login é `@Public()`. Change-password **não** é public — precisa Bearer.
- **Não** usar `@RolesAuth` (qualquer role autenticada: `SUPER_ADMIN`, `ADMIN`, `USER`). Sem roles no handler, `RolesGuard` deixa passar se o JWT for válido.
- JWT payload: `libs/contracts` `UserToken` — `userId` / `id` (auth.service seta os dois como `user.id`).
- Hash: `bcrypt` rounds **10**, igual `UsersService` (`BCRYPT_ROUNDS = 10`).
- `POST /tenant/:tenantId/users/:userId/reset-password` **não** muda. Super Admin continua 403 lá (`UsersService.resetPassword`).
- DTO senha: `MinLength(6)` como `ResetPasswordDto` / `CreateTenantUserDto`.
- Não invalidar sessões/JWTs existentes (TTL 1d inalterado).
- `AuthGuard` exige Bearer; 401 sem token é o comportamento atual.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/gym-ctrl/src/modules/auth.controller.ts` | editar |
| `apps/gym-ctrl/src/modules/auth.service.ts` | editar |
| `apps/gym-ctrl/src/dtos/change-password.dto.ts` | criar |
| `apps/gym-ctrl/src/modules/auth.service.spec.ts` | criar |

---

## 5.1 — Endpoint e testes

### O que fazer

`POST /auth/change-password` body:

```json
{ "currentPassword": "antiga", "newPassword": "nova-senha" }
```

Fluxo:

1. Carregar user por `req.user.userId` (ou `id`).
2. Se não achar → 401.
3. `bcrypt.compare(currentPassword, user.password)` false → `UnauthorizedException` ou `BadRequestException` (escolher um e documentar no Swagger; preferir **401** para não confirmar existência além do JWT já válido — na prática o user existe). Spec aceita 401 ou 400.
4. `bcrypt.hash(newPassword, 10)` e `prisma.user.update`.
5. Response: `{ ok: true }` **ou** o `userSelect` sem password. Não devolver hash. Preferir `{ ok: true }` para não vazar PII extra.

Não exigir tenantId na URL.

Testes (`auth.service.spec.ts`):

- compare true → update com hash novo
- compare false → throw, `update` não chamado
- user id inexistente → throw

```bash
npx jest apps/gym-ctrl/src/modules/auth.service.spec.ts
```

### Critérios de aceite

- [ ] Rota autenticada `POST /auth/change-password`
- [ ] Senha atual errada não altera o hash
- [ ] Senha nova hasheada com 10 rounds
- [ ] Sem `@Public()` e sem `@RolesAuth`
- [ ] `reset-password` de colega intocado
- [ ] Jest passa

### Não fazer

- Não criar fluxo esqueci-senha deslogado
- Não pedir aprovação de Super Admin
- Não devolver `password` no JSON
- Não exigir `currentPassword` igual a `newPassword` como erro especial (opcional rejeitar se iguais — não obrigatório)

---

## Verificação do grupo

```bash
npx jest apps/gym-ctrl/src/modules/auth.service.spec.ts
```

## Handoff para próxima task

Front logado chama `POST /auth/change-password`. Login seguinte usa a senha nova. Task 6 adiciona a request Postman e o parágrafo no FRONT-INTEGRATION.
