# Task 1 — Dependências e configuração

**Change:** `realtime-inbox-websocket`
**Grupo:** 1 de 5
**Pré-requisitos:** nenhum
**Desbloqueia:** [task-02-gym-ctrl-gateway-websocket.md](./task-02-gym-ctrl-gateway-websocket.md), [task-03-gym-ctrl-endpoint-interno-de-notify.md](./task-03-gym-ctrl-endpoint-interno-de-notify.md), [task-04-notifly-disparo-apos-inbound-persistido.md](./task-04-notifly-disparo-apos-inbound-persistido.md)

## Objetivo do grupo

Instalar dependências WebSocket no monorepo e definir variáveis de ambiente compartilhadas entre gym-ctrl e notifly.

## Contexto para o subagent

- Monorepo NestJS; dependências ficam no **root** `package.json` (não por app).
- gym-ctrl config: `apps/gym-ctrl/src/gym.module.ts` — Joi validation schema.
- notifly **não** tem Joi global hoje; `dotenv/config` em `apps/notifly/src/main.ts`.
- `@nestjs/websockets` já é peer no lockfile; falta instalar `@nestjs/platform-ws` e `ws`.
- Auth JWT existente: `JWT_SECRET`, payload `UserToken` em `libs/contracts/user-token.ts`.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `package.json` | editar (dependencies + devDependencies) |
| `package-lock.json` | editar (npm install) |
| `apps/gym-ctrl/src/gym.module.ts` | editar (Joi keys) |

---

## 1.1 — Dependências npm e Joi gym-ctrl

### O que fazer

1. No root `package.json`, adicionar:
   - `"@nestjs/websockets": "^11.0.0"` (ou alinhar versão com `@nestjs/core`)
   - `"@nestjs/platform-ws": "^11.0.0"`
   - `"ws": "^8.18.0"`
   - dev: `"@types/ws": "^8.5.0"`

2. Rodar `npm install` na raiz.

3. Em `apps/gym-ctrl/src/gym.module.ts`, estender `validationSchema`:

```typescript
INTERNAL_WS_NOTIFY_SECRET: Joi.string().required().description('Secret compartilhado com notifly para POST /internal/inbox/realtime/notify'),
WS_INBOX_PATH: Joi.string().default('ws/inbox').description('Path do WebSocket gateway'),
WS_ALLOWED_ORIGINS: Joi.string().optional().description('Origens CORS WS separadas por vírgula; omitir = permissivo em dev'),
```

4. **Não** alterar `GYM_PORT` nem `JWT_SECRET`.

### Critérios de aceite

- [ ] `npm run gym:build` compila sem erro de módulo ausente
- [ ] App gym-ctrl sobe exigindo `INTERNAL_WS_NOTIFY_SECRET` definido

### Não fazer

- Instalar `socket.io` ou `@nestjs/platform-socket.io`
- Adicionar Redis

---

## 1.2 — Env vars notifly

### O que fazer

Documentar e ler via `process.env` (ou ConfigModule se preferir consistência futura):

| Variável | Obrigatória | Exemplo |
|----------|-------------|---------|
| `GYM_CTRL_BASE_URL` | sim em PRD | `http://localhost:3000` |
| `INTERNAL_WS_NOTIFY_SECRET` | sim | mesmo valor do gym-ctrl |

Adicionar comentário no topo de `apps/notifly/src/main.ts` ou README interno da change listando as vars.

Se notifly tiver `.env.example` no repo, adicionar entradas lá.

### Critérios de aceite

- [ ] Vars documentadas para deploy conjunto gym-ctrl + notifly
- [ ] Secret idêntico nos dois serviços

### Não fazer

- Expor secret em swagger público

---

## Verificação do grupo

```bash
npm install
npm run gym:build
npm run notifly:build
```

Com `.env` contendo `INTERNAL_WS_NOTIFY_SECRET=test-secret`.

## Handoff para próxima task

Dependências instaladas; gym-ctrl valida env; notifly sabe URL base e secret para task 4.
