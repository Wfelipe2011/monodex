## Context

O monorepo já tem `gym-ctrl` com `POST /auth/login` (JWT), `AuthGuard` + `RolesGuard` globais e Swagger em `/api`, mas quase nenhuma rota de domínio. O notifly já opera outreach a partir de `TenantOutreachConfig` e `WhatsappAccount` (change arquivada `operationalize-tenant-outreach`). Operadores ainda dependem de SQL/`seed-outreach.ts`. Esta change adiciona a API de plataforma no gym — **sem frontend**.

Insumo de exploração: `openspec/explore/02-painel-super-admin.md`.

## Goals / Non-Goals

**Goals:**

- Role `SUPER_ADMIN` + bootstrap (tenant plataforma + user).
- API `/admin/*` no `gym-ctrl` para onboarding e config sem SQL.
- Alinhar crédito de coins à forma como o notifly debita (`findFirst` user do tenant).
- Swagger utilizável com Bearer JWT.

**Non-Goals:**

- Frontend / SPA / dashboard.
- Auth nos workers captura/notifly.
- Remover hardcode do captura; Baileys; ScrapeJob; billing; audit log dedicado; multi-WABA por tenant.

## Decisions

### D1 — Identidade: `SUPER_ADMIN` em `User` + tenant plataforma

- **Escolha:** Adicionar `SUPER_ADMIN` ao enum `Roles`. Seedar tenant especial (ex. name `Platform`) e user com `roles: [SUPER_ADMIN]`.
- **Por quê:** `User.tenantId` é obrigatório; evita schema breaking (`tenantId` opcional) e evita tabela `PlatformUser`.
- **Alternativas:** `PlatformUser` separado (mais limpo semanticamente, mais código); `tenantId` null (migration maior).

Autorização cross-tenant: apenas presença de `SUPER_ADMIN` no JWT — não usar `tenantId` do token para filtrar dados de plataforma.

### D2 — Superfície: expandir `gym-ctrl`, prefixo `/admin`

- **Escolha:** Novos módulos sob `apps/gym-ctrl/src/modules/admin/`, controllers com `@RolesAuth(Roles.SUPER_ADMIN)`.
- **Por quê:** Login e guards já existem; um serviço novo seria deploy extra sem ganho nesta etapa.
- **Alternativas:** App `admin` separado (adiado).

Login permanece `POST /auth/login` — mesmo contrato.

### D3 — `Tenant.active`

- **Escolha:** Coluna `active Boolean @default(true)` em `Tenant`.
- **Por quê:** Desativar cliente ≠ `outreachConfig.enabled`.
- **Regra:** `enabled=true` em outreach exige `phone` preenchido e `active === true`.

### D4 — Coins / carteira

- **Escolha:** Endpoints de credit/debit exigem `userId` explícito. Onboarding documentado: criar um ADMIN e creditar nesse user.
- **Alinhamento runtime:** notifly usa `coin.findFirst({ tenantId })` para elegibilidade e `user.findFirst({ tenantId })` para debitar — não determinístico se houver vários users. MVP recomenda um user operacional por tenant com coin; não refatorar notifly nesta change (risco aceito / follow-up).

### D5 — Configs

- **Outreach:** `PUT` upsert + `PATCH` parcial em `/admin/tenants/:tenantId/outreach-config`.
- **WhatsApp:** só contas `tenantId = null`; body nunca aceita token — só `tokenEnvKey`, `phoneNumberId`, etc.

### D6 — Email unique

- **Escolha nesta change:** **não** remover `@unique` global de `email` (escopo mínimo). Documentar limitação: mesmo e-mail não pode existir em dois tenants.
- Follow-up se necessário.

### D7 — Bootstrap

- Script/seed idempotente (ex. `prisma/seed-platform-admin.ts` ou extensão de seed existente) lendo `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD` (ou defaults só em development).
- Sem endpoint público de “criar primeiro super admin”.

### D8 — Swagger

- `DocumentBuilder.addBearerAuth()` + `@ApiBearerAuth()` nos controllers admin.
- Consumo MVP = Swagger UI.

### Estrutura de módulos sugerida

```
apps/gym-ctrl/src/modules/admin/
  admin.module.ts
  tenants.controller.ts / tenants.service.ts
  users.controller.ts / users.service.ts
  coins.controller.ts / coins.service.ts
  outreach-config.controller.ts / outreach-config.service.ts
  whatsapp-accounts.controller.ts / whatsapp-accounts.service.ts
  ops.controller.ts / ops.service.ts
```

Importar `AdminModule` em `GymModule`. Reutilizar `PrismaService` de `@core/infra`.

### Catálogo de endpoints (contrato)

| Área | Métodos |
|------|---------|
| Tenants | `GET/POST /admin/tenants`, `GET/PATCH /admin/tenants/:id` |
| Users | `GET/POST /admin/tenants/:tenantId/users`, `PATCH .../users/:userId`, `POST .../reset-password` |
| Coins | `GET .../coins`, `POST .../coins/credit`, `POST .../coins/debit`, `GET .../coin-transactions` |
| Outreach | `GET/PUT/PATCH /admin/tenants/:tenantId/outreach-config` |
| WABA | `GET/POST /admin/whatsapp-accounts`, `GET/PATCH /admin/whatsapp-accounts/:id` |
| Ops | `GET /admin/ops/summary`, `GET /admin/tenants/:tenantId/leads/stats`, `GET /admin/leads/count` |

Promover user de tenant a `SUPER_ADMIN` via endpoints de tenant users: **proibido**. Novo super admin só via seed (MVP) ou endpoint dedicado futuro.

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| Débito notifly no “user errado” se houver vários users | Documentar: um admin operacional com coin; follow-up alinhar notifly a user explícito na config |
| `SUPER_ADMIN` num tenant “Platform” polui lista de tenants | Filtrar `name = Platform` / flag futura; ou excluir do summary comercial |
| Email unique global | Fora desta change; documentar |
| Endpoints `/admin` abertos se guard falhar | Testes: ADMIN de tenant → 403; sem token → 401 |
| Token Meta vazado em logs/responses | Nunca serializar secrets; só `tokenEnvKey` |
| `.env` aponta DB remoto | Seed/bootstrap só com confirmação; cuidado em apply |

## Migration Plan

1. Migration: enum `SUPER_ADMIN` + `Tenant.active` (default true).
2. Deploy gym com novos módulos (compatível — rotas novas).
3. Rodar seed bootstrap plataforma.
4. Operador usa Swagger: login → sequência onboarding.
5. Rollback: reverter deploy gym; coluna `active` e enum são backward-compatible se não forem removed agressivamente; seed não apaga tenants comerciais.

## Open Questions

1. Nome exato do tenant plataforma (`Platform` vs `__platform__`) — default `Platform`.
2. Endpoint `POST /admin/platform-users` no MVP? **Não** — só seed.
3. Prefixo `/admin` vs `/platform`? **`/admin`**.
4. Atalho monólito `POST /admin/tenants/onboard`? **Não no MVP** — sequência de endpoints.
