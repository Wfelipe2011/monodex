# Task 2 — Shared — hash de chave e AuthGuard dual-mode

**Change:** `tenant-api-keys-on-demand-send`
**Grupo:** 2 de 8
**Pré-requisitos:** [task-01](./task-01-schema-e-migration.md)
**Desbloqueia:** [task-03](./task-03-admin-grant-chaves-e-preco-on-demand.md), [task-04](./task-04-midia-upload-listagem-get-publico-e-cron-de-orfaos.md), [task-05](./task-05-gym-ctrl-send-on-demand-e-dual-auth-nas-rotas-existentes.md), [task-07](./task-07-agendas-api-e-worker-horario.md)

## Objetivo do grupo

Chave gerável/hasheável no shared e `AuthGuard` aceitando JWT **ou** `X-API-KEY` só em rotas com decorator de allowlist.

## Contexto para o subagent

- Hash de convite (copiar o padrão, **não** reusar o alfabeto curto): `libs/shared/invite-token.ts` (`hashInviteToken` = sha256 hex).
- Guard atual: `libs/guard/auth.guard.ts` — só Bearer; `@Public()` via `IS_PUBLIC_KEY` em `libs/decorators/public.decorator.ts`.
- `UserToken`: `libs/contracts/user-token.ts` (`id`, `userId`, `userName`, `tenantId`, `roles`).
- `RequestUser`: `libs/contracts/request-user.ts`.
- `RolesGuard`: `libs/guard/roles.guard.ts` — lê `user.roles`.
- `TenantScopeGuard`: `libs/guard/tenant-scope.guard.ts` — compara `params.tenantId` com `user.tenantId`; Super Admin passa.
- Auth module registra guards globais: `apps/gym-ctrl/src/modules/auth.module.ts`.
- CORS em `apps/gym-ctrl/src/main.ts` (`allowedHeaders: 'Content-Type, Authorization'`).
- Prisma lookup precisará de `PrismaService` no guard **ou** de um `ApiKeyAuthService` injetável — hoje `AuthGuard` é síncrono e só verifica JWT. Tornar `canActivate` async é ok.
- Não implementar CRUD de chaves aqui (grupo 3); o guard pode assumir o model já migrado.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `libs/shared/api-key.ts` | criar |
| `libs/shared/api-key.spec.ts` | criar |
| `libs/decorators/api-key-allowlist.decorator.ts` | criar |
| `libs/contracts/user-token.ts` | editar |
| `libs/guard/auth.guard.ts` | editar |
| `libs/guard/auth.guard.spec.ts` | criar/editar |
| `apps/gym-ctrl/src/main.ts` | editar CORS |
| `apps/gym-ctrl/src/modules/auth.module.ts` | editar se o guard precisar Prisma |

---

## 2.1 — Helpers de gerar/hashear

### O que fazer

Criar `libs/shared/api-key.ts`:

- `generateApiKey()`: string `mdx_live_` + 32 bytes hex (ou similar, alta entropia).
- `hashApiKey(raw)`: `createHash('sha256').update(raw, 'utf8').digest('hex')` — mesmo algoritmo do convite.
- `apiKeyPrefix(raw)`: primeiros caracteres estáveis para UI (ex. `mdx_live_` + 8 hex). **Não** usar o hash como prefixo.

Testes colocalizados: hash determinístico; generate não colide em amostra; prefixo não contém o secret inteiro.

### Critérios de aceite

- [ ] `hashApiKey(raw) === createHash('sha256')...`
- [ ] Prefixo ≠ raw completo

### Não fazer

- Não reusar `generateInviteToken` (8 chars Crockford) — entropia baixa demais
- Não persistir nada nesta subtask

---

## 2.2 — UserToken sintético e AuthGuard

### O que fazer

Estender `UserToken` com campos opcionais: `authKind?: 'jwt' | 'api_key'`, `apiKeyId?: number`. JWT continua preenchendo `userId`. Chave: `roles=[ADMIN]`, `tenantId` da row, `userId`/`id` podem ser `0` ou omitidos — **RolesGuard e TenantScopeGuard não podem quebrar**. Conversas hoje fazem `req.user.roles?.includes(SUPER_ADMIN)` — chave sem essa role está correta.

`AuthGuard.canActivate` async:

1. `@Public()` → true (igual hoje).
2. Se `X-API-KEY` **e** `Authorization` presentes → 400.
3. Se `X-API-KEY`: lookup `keyHash`; 401 se missing/revogada/`apiAccessEnabled=false`/tenant inexistente; senão set `request.user` e `lastUsedAt` (fire-and-forget update ok).
4. Senão: fluxo JWT atual.

Header name: `x-api-key` (Express lowercases).

### Critérios de aceite

- [ ] Chave válida monta `authKind=api_key` e `roles` inclui `ADMIN`
- [ ] JWT inalterado para rotas sem chave
- [ ] Ambos os headers → 400

### Não fazer

- Não aceitar chave em `/platform` nesta subtask ainda (allowlist na 2.3)
- Não criar chaves de teste no banco de produção

---

## 2.3 — Allowlist decorator e CORS

### O que fazer

Decorator `@ApiKeyAllowlist()` (metadata, padrão `@Public()` / `@RolesAuth`). Guard: se autenticou por chave e o handler/class **não** tem a metadata → 401 (mesmo com chave válida).

Nenhuma rota recebe o decorator neste grupo (grupos 4/5/7 aplicam). Teste unitário do guard com reflector mock: rota sem metadata + chave válida = 401.

`main.ts` CORS `allowedHeaders` incluir `X-API-KEY` (e manter `Authorization`, `Content-Type`).

Swagger `addApiKey` pode ficar para o grupo 8; se for trivial no `DocumentBuilder`, ok adicionar agora.

### Critérios de aceite

- [ ] Chave válida em rota sem decorator → 401
- [ ] CORS lista `X-API-KEY`

### Não fazer

- Não marcar `public-invites` nem `auth/login` com allowlist (já são `@Public()`)
- Não abrir `/platform/*`

---

## 2.4 — Testes

### O que fazer

Cobrir: hash; generate; prefix; guard público; JWT ok; chave ok **com** metadata; chave sem metadata 401; revogada 401; grant off 401; JWT+chave 400; `/platform` simulado sem metadata 401.

### Critérios de aceite

- [ ] Specs Jest passam

### Não fazer

- Não exigir e2e HTTP neste grupo

---

## Verificação do grupo

Jest dos arquivos novos/alterados; `AuthGuard` async não quebra login JWT existente (`apps/gym-ctrl/src/modules/auth.controller.ts`).

## Handoff para próxima task

Grupo 3 cria as chaves de verdade. Controllers novos devem usar `@ApiKeyAllowlist()` só onde o design D8 permite. **Não** colocar allowlist em `/tenant/:id/api-keys`.
