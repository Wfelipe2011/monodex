# Task 4 — API de coins

**Change:** `painel-super-admin`
**Grupo:** 4 de 6
**Pré-requisitos:** [Task 3](./task-03-api-de-tenants-e-users.md)
**Desbloqueia:** [Task 6](./task-06-leitura-operacional-e-verificacao.md) (onboarding E2E); usado junto com Task 5 no fluxo completo

## Objetivo do grupo

Super admin visualiza saldos, credita/debita com `CoinTransaction`, alinhado ao modelo `Coin` (`userId`+`tenantId`).

## Contexto para o subagent

- Models: `Coin` (`@@unique([userId, tenantId])`), `CoinTransaction`, enum `CoinTransactionType`: `CREDITO`, `DEBITO`, `TRANSFERENCIA`, `BONUS`.
- Runtime notifly (`apps/notifly/src/leads.service.ts`): elegibilidade `coin.findFirst({ tenantId })`; débito usa `user.findFirst({ tenantId })` + update composto `userId_tenantId`. Por isso o crédito de onboarding deve ir no **mesmo user ADMIN** criado na Task 3.
- Usar transação Prisma (`$transaction`) para balance + transaction row.
- Marcar operador: `description` inclui `bySuperAdmin:{jwt.userId}`.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/gym-ctrl/src/modules/admin/coins.controller.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/coins.service.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/dto/coin-*.dto.ts` | criar |
| `admin.module.ts` | editar |

---

## 4.1 — Leitura de coins e transactions

### O que fazer

| Método | Path |
|--------|------|
| `GET` | `/admin/tenants/:tenantId/coins` |
| `GET` | `/admin/tenants/:tenantId/coin-transactions?limit=50` |

Retornar `userId`, `balance`, `uuid` nas coins; transactions ordenadas `createdAt desc`.

### Critérios de aceite

- [x] Lista coins do tenant
- [x] Lista transactions recentes


### Não fazer

- Não expor dados de outros tenants no mesmo call

---

## 4.2 — Credit e debit

### O que fazer

| Método | Path | Body |
|--------|------|------|
| `POST` | `/admin/tenants/:tenantId/coins/credit` | `{ userId, amount, description?, type?: 'CREDITO'\|'BONUS' }` |
| `POST` | `/admin/tenants/:tenantId/coins/debit` | `{ userId, amount, description? }` |

Regras:

- `amount > 0` senão 400.
- Validar user pertence ao tenant.
- Upsert coin se não existir no credit (`create` balance=amount).
- Debit: se insuficiente → 400; gravar `CoinTransaction` com `amount` negativo ou positivo conforme padrão do notifly (notifly usa `amount: -config.costPerLead` no DEBITO — **seguir o mesmo padrão**).
- Credit: type default `CREDITO`; amount positivo na row.

### Critérios de aceite

- [x] Credit aumenta balance e cria transaction
- [x] Debit diminui e cria transaction
- [x] Debit sem saldo → 400 sem side effects


### Não fazer

- Não alterar lógica de débito do notifly nesta task

---

## 4.3 — Marcador do operador

### O que fazer

Ao montar `description`, anexar `bySuperAdmin:{id}` a partir de `req.user` (`UserToken.userId` ou `id`).

Ex.: `Credito inicial onboarding | bySuperAdmin:1`

### Critérios de aceite

- [x] Toda credit/debit persiste description contendo o id do super admin


### Não fazer

- Não criar tabela de audit log

---

## Verificação do grupo

Credit 10 → GET coins mostra 10 → debit 3 → balance 7 → transactions com 2 linhas.

## Handoff para próxima task

Saldo suficiente para habilitar outreach (Task 5/6). Documentar que credit deve ser no user que o notifly encontrará com `findFirst`.
