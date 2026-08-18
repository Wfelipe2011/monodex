# Task 3 — gym-ctrl — API de subscriptions

**Change:** `inbox-web-push`
**Grupo:** 3 de 5
**Pré-requisitos:** [task-01-schema-e-migration.md](./task-01-schema-e-migration.md)
**Desbloqueia:** [task-05-documentacao-front-e-verificacao.md](./task-05-documentacao-front-e-verificacao.md)

## Objetivo do grupo

Endpoints REST para o front registrar/remover PushSubscription após login.

## Contexto para o subagent

- Auth: `AuthGuard` global; `@RequestUser()` ou `request.user` como `UserToken` (`libs/contracts/user-token.ts`)
- Admin controllers pattern: `apps/gym-ctrl/src/modules/admin/*.controller.ts`
- Pode colocar em `apps/gym-ctrl/src/modules/inbox-realtime/push-subscriptions.controller.ts` ou admin module

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `push-subscriptions.controller.ts` | criar |
| `dto/upsert-push-subscription.dto.ts` | criar |
| `dto/delete-push-subscription.dto.ts` | criar |
| `inbox-realtime.module.ts` | registrar controller |

---

## 3.1 — PUT e DELETE /admin/push-subscriptions

### O que fazer

**DTO upsert:**
```typescript
class PushSubscriptionKeysDto {
  @IsString() p256dh: string;
  @IsString() auth: string;
}
class UpsertPushSubscriptionDto {
  @IsString() endpoint: string;
  @ValidateNested() @Type(() => PushSubscriptionKeysDto) keys: PushSubscriptionKeysDto;
}
```

**PUT** `/admin/push-subscriptions`
- Auth required (JWT)
- Upsert:
```typescript
await prisma.pushSubscription.upsert({
  where: { endpoint: dto.endpoint },
  create: { userId: user.userId, endpoint, p256dh: dto.keys.p256dh, auth: dto.keys.auth, userAgent: req.headers['user-agent'] },
  update: { userId: user.userId, p256dh, auth, userAgent },
});
```
- Return 204 or `{ ok: true }`

**DELETE** `/admin/push-subscriptions` body `{ endpoint }`
- Delete only where `endpoint` AND `userId` match authenticated user
- 404 if not found optional; 204 on success

Swagger tags: `Admin — Push` or include in inbox-realtime.

### Critérios de aceite

- [ ] Unauthenticated → 401
- [ ] PUT creates/updates row for current user
- [ ] DELETE only own subscription

### Não fazer

- `@RolesAuth(SUPER_ADMIN)` only — any authenticated user may register (future tenant inbox)

---

## Verificação do grupo

```bash
npm run gym:build
# curl PUT with Bearer token after login
```

## Handoff

Front can register subscriptions via documented API.
