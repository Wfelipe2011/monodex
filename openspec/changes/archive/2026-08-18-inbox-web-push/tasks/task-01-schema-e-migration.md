# Task 1 — Schema e migration

**Change:** `inbox-web-push`
**Grupo:** 1 de 5
**Pré-requisitos:** nenhum
**Desbloqueia:** [task-02-gym-ctrl-web-push-service-e-env.md](./task-02-gym-ctrl-web-push-service-e-env.md), [task-03-gym-ctrl-api-de-subscriptions.md](./task-03-gym-ctrl-api-de-subscriptions.md)

## Objetivo do grupo

Persistir PushSubscription por usuário autenticado.

## Contexto para o subagent

- Prisma em `prisma/schema.prisma`; `User` model linha ~34.
- Padrão snake_case `@map` nos models existentes.
- Rodar migration após alterar schema.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `prisma/schema.prisma` | editar |
| `prisma/migrations/*` | criar (via prisma migrate) |

---

## 1.1 — Modelo PushSubscription

### O que fazer

Adicionar:

```prisma
model PushSubscription {
  id        Int      @id @default(autoincrement())
  userId    Int      @map("user_id")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  endpoint  String   @unique
  p256dh    String
  auth      String
  userAgent String?  @map("user_agent")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([userId])
  @@map("push_subscriptions")
}
```

Em `User`, adicionar: `pushSubscriptions PushSubscription[]`

Gerar migration:
```bash
npx prisma migrate dev --name add_push_subscriptions
```

### Critérios de aceite

- [ ] `npx prisma generate` OK
- [ ] Migration aplicável sem conflito
- [ ] `endpoint` unique globalmente

### Não fazer

- Campos por tenant na subscription (tenant vem do User)

---

## Verificação do grupo

```bash
npx prisma validate
npx prisma generate
```

## Handoff

Tabela `push_subscriptions` pronta para API e WebPushService.
