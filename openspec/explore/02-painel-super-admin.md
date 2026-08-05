# Painel Super Admin — base para proposta futura (backend / API)

> Artefato de exploração (criado 2026-08-04, **rebase 2026-08-05**). **Não é uma proposta OpenSpec ainda.**
> Objetivo: dar contexto suficiente para um agent gerar `/opsx-propose` (ou propose-v2) depois.
>
> **Escopo desta etapa: só backend.** Role `SUPER_ADMIN`, schema mínimo, endpoints no `gym-ctrl`, consumo via Swagger/HTTP client. **Frontend / dashboard / SPA ficam fora** — wave futura.

## Estado atual

### Existe painel de super admin?

**Não.** Também **não existe dashboard/SPA** — e esta explore **não** propõe criar um.

| O que existe | O que não existe |
|--------------|------------------|
| `Roles` enum: `ADMIN`, `USER` (por tenant) | Role `SUPER_ADMIN` |
| `POST /auth/login` → JWT no `gym-ctrl` | Endpoints de gestão de plataforma |
| Swagger em `/api` | CRUD tenants / users / coins / configs |
| `AuthGuard` + `RolesGuard` globais; `@RolesAuth` nunca usado | Rotas protegidas por role |
| `CreateUserDto` órfão | Controller/service de users |
| Schema + configs de outreach no DB | API para o operador mutar essas configs |

Auth hoje:

```
POST /auth/login  →  JWT { id, userId, userName, roles, tenantId }
                              │
                              ▼
                     AuthGuard + RolesGuard (globais no gym)
                     Nenhuma rota usa @RolesAuth(...)
```

Superfície real do gym hoje: `POST /auth/login`, `GET /health-check`, Swagger. Sem UI de login — só API.

### O que mudou desde a primeira versão (04/08 → 05/08)

A change `operationalize-tenant-outreach` colocou configs no DB. Painel / `SUPER_ADMIN` ficaram fora.

| Antes | Agora (pós-outreach) |
|-------|----------------------|
| Welcome hardcoded | Runtime lê `Tenant.uuid` + `phone` |
| Pricing / templates / WABA no código | `TenantOutreachConfig` + `WhatsappAccount` |
| Cron `tenantId: 8` | Cron por `outreachConfig.enabled` + saldo + schedule |
| Onboarding = patch de código | Onboarding = SQL / `prisma/seed-outreach.ts` |

A API do super admin é o que **substitui o seed/SQL** como operador dessas tabelas. Welcome já está no runtime — a API só garante dados corretos.

```
 SUPER_ADMIN (API gym)              Runtime notifly (já lê DB)
        │                                    │
        │  CRUD Tenant / User / Coin          │
        │  CRUD TenantOutreachConfig          ├── welcome
        │  CRUD WhatsappAccount               ├── cron / templates / pricing
        └─────────────────────────────────────┴── débito coins
```

---

## Problema que a API resolve

Sem SQL/seed manual:

- Criar tenant / user / creditar coins
- Ligar outreach (`TenantOutreachConfig`)
- Ajustar conta Cloud API da plataforma (`WhatsappAccount`)
- Consultar saldo e funil cross-tenant

```
                    ┌─────────────────────┐
                    │   SUPER_ADMIN       │  ← role + endpoints (esta etapa)
                    │  (plataforma)       │
                    └──────────┬──────────┘
           ┌───────────────────┼───────────────────┐
           ▼                   ▼                   ▼
     ┌──────────┐        ┌──────────┐        ┌──────────┐
     │ Tenant A │        │ Tenant B │        │ Tenant C │
     │ ADMIN    │        │ ADMIN    │        │ ADMIN    │
     └──────────┘        └──────────┘        └──────────┘
```

---

## Decisões de exploração

| Tema | Decisão |
|------|--------|
| Escopo desta etapa | **Só backend** no `gym-ctrl` (+ Swagger). Sem frontend. |
| Identidade | Role **`SUPER_ADMIN`** no enum `Roles` do model `User` |
| Onde mora | Expandir **`gym-ctrl`** — mesmo login `POST /auth/login` |
| Consumo imediato | Swagger `/api` + Bearer JWT |
| Canal outreach | Cloud API / notifly (não gerenciar Baileys nesta API) |
| Marketplace | `Lead` global + `TenantLead` mantidos |

### `SUPER_ADMIN` em `User` (tenantId obrigatório)

Preferência: **tenant plataforma seedado** (ex. name `Platform`) onde vive o user com `roles: [SUPER_ADMIN]`. JWT continua com `tenantId`; autorização cross-tenant vem só da role.

Alternativas (proposta pode trocar): `tenantId` opcional; ou user em tenant real + role platform (mais ambíguo).

### Carteira / débito (alinhar API ao runtime)

Notifly hoje:

- Elegibilidade: `coin.findFirst({ where: { tenantId } })` — primeira coin do tenant
- Débito: `user.findFirst({ where: { tenantId } })` → `coin` daquele `userId+tenantId`

MVP da API: ao criar admin + crédito, **sempre** creditar na coin do **primeiro ADMIN** do tenant (o user criado no onboarding). Evitar múltiplos users com coin se o runtime ainda é `findFirst` não determinístico — documentar risco se já existirem vários users.

---

## Backend — o que o `gym-ctrl` precisa ganhar

### 1. Schema / Prisma

```
enum Roles {
  ADMIN
  USER
  SUPER_ADMIN          // NOVO
}

model Tenant {
  ...
  active  Boolean @default(true)   // NOVO — preferência; desativar cliente ≠ desligar outreach
}
```

- Migration + regenerate client
- Seed/bootstrap documentado:
  - Tenant plataforma
  - User `SUPER_ADMIN` (email/senha via env ou script one-shot)
  - (Opcional) não duplicar lógica do `seed-outreach.ts` — API passa a ser o caminho feliz

**Fora do schema desta etapa:** `PlatformUser` separado, `PlatformAuditLog`, mudanças em `Message`/`WhatsapContact`, `ScrapeJob`.

**Tensão email:** `User.email @unique` global vs `@@unique([email, tenantId])`. Proposta decide se remove o unique global neste change.

### 2. Auth / autorização

Já existe: login, JWT, `AuthGuard`, `RolesGuard`, decorator `@RolesAuth(...)`.

Falta usar:

```
@RolesAuth(Roles.SUPER_ADMIN)
@Controller('admin/...')   // ou prefixo /platform/
```

Regras:

| Ator | Pode |
|------|------|
| Sem token | Só `@Public()` (`/auth/login`, `/health-check`) |
| `ADMIN` / `USER` de tenant | **Nada** sob `/admin/*` (403) |
| `SUPER_ADMIN` | Todos os endpoints de plataforma abaixo |

Swagger: documentar Bearer JWT (`addBearerAuth` se ainda não existir).

`POST /auth/login` **não muda** — mesmo contrato; user plataforma também loga por email/senha e recebe JWT com `roles: [SUPER_ADMIN]`.

### 3. Módulos sugeridos no gym

```
apps/gym-ctrl/src/
  modules/auth/          (já existe)
  modules/admin/
    admin.module.ts
    tenants.controller.ts + tenants.service.ts
    users.controller.ts + users.service.ts
    coins.controller.ts + coins.service.ts
    outreach-config.controller.ts + service
    whatsapp-accounts.controller.ts + service
    ops-read.controller.ts + service   // leituras agregadas
```

Todos os controllers admin: `@RolesAuth(Roles.SUPER_ADMIN)` no controller (ou em cada rota).

### 4. Catálogo de endpoints (MVP)

Prefixo sugerido: `/admin`. Todos exigem JWT + `SUPER_ADMIN`.

#### Tenants

| Método | Path | Body / notes |
|--------|------|--------------|
| `GET` | `/admin/tenants` | Lista; query opcional `active`, `outreachEnabled` |
| `GET` | `/admin/tenants/:id` | Detalhe + resumo outreach/saldo se útil |
| `POST` | `/admin/tenants` | `{ name, phone?, active? }` → cria `uuid` |
| `PATCH` | `/admin/tenants/:id` | `{ name?, phone?, active? }` |
| — | sem hard delete no MVP | desativar via `active=false` |

Validação: se for habilitar outreach depois, `phone` obrigatório (pode validar no upsert de config).

#### Users do tenant

| Método | Path | Body / notes |
|--------|------|--------------|
| `GET` | `/admin/tenants/:tenantId/users` | Lista users do tenant |
| `POST` | `/admin/tenants/:tenantId/users` | `{ name, username, email, password, roles? }` default `[ADMIN]` |
| `POST` | `/admin/tenants/:tenantId/users/:userId/reset-password` | `{ password }` |
| `PATCH` | `/admin/tenants/:tenantId/users/:userId` | `{ name?, roles? }` — **não** permitir promover a `SUPER_ADMIN` sem regra explícita |

Regras:

- Hash bcrypt na escrita (mesmo padrão do que o login espera)
- Não criar `SUPER_ADMIN` via endpoint de tenant user (endpoint separado ou seed-only no MVP)
- Opcional MVP+: `POST /admin/platform-users` para criar outro super admin

#### Coins

| Método | Path | Body / notes |
|--------|------|--------------|
| `GET` | `/admin/tenants/:tenantId/coins` | Saldos `userId + balance` do tenant |
| `POST` | `/admin/tenants/:tenantId/coins/credit` | `{ userId, amount, description? }` → `CREDITO`/`BONUS` |
| `POST` | `/admin/tenants/:tenantId/coins/debit` | `{ userId, amount, description? }` → `DEBITO` |
| `GET` | `/admin/tenants/:tenantId/coin-transactions` | Últimas N; paginação simples |

Sempre gravar `CoinTransaction`. Em `description`, incluir marcador do operador (ex. `bySuperAdmin:${userId}`) até existir audit log.

Atalho onboarding (nice dentro do MVP se simples): `POST /admin/tenants/:tenantId/onboard` com tenant+admin+crédito+config num body — senão o cliente HTTP chama endpoints em sequência.

#### TenantOutreachConfig (config do sistema por tenant)

| Método | Path | Body / notes |
|--------|------|--------------|
| `GET` | `/admin/tenants/:tenantId/outreach-config` | 404 se não existir |
| `PUT` | `/admin/tenants/:tenantId/outreach-config` | Upsert completo |
| `PATCH` | `/admin/tenants/:tenantId/outreach-config` | Parcial (ex. só `{ enabled: true }`) |

Campos do body (espelham model):

```
enabled
costPerLead
cashbackOnReply
outreachTemplateName
notifyTenantTemplateName
schedule          // JSON — mesmo formato do seed { "2": [18], ... }
categories        // JSON string[]
```

Validações:

- `enabled=true` ⇒ `Tenant.phone` não nulo/vazio; `Tenant.active !== false`
- `costPerLead > 0`
- Templates strings não vazias se enabled

#### WhatsappAccount (config da plataforma)

| Método | Path | Body / notes |
|--------|------|--------------|
| `GET` | `/admin/whatsapp-accounts` | Lista; filtrar `tenantId=null` (plataforma) |
| `GET` | `/admin/whatsapp-accounts/:id` | Detalhe — **nunca** devolver token |
| `POST` | `/admin/whatsapp-accounts` | `{ phoneNumberId, displayPhone?, tokenEnvKey?, enabled? }` força `tenantId: null` |
| `PATCH` | `/admin/whatsapp-accounts/:id` | Mesmos campos |

Regras:

- Token só via env (`process.env[tokenEnvKey]`) — API não aceita nem retorna secret
- MVP: apenas contas de plataforma (`tenantId = null`); rejeitar body com `tenantId` de cliente

#### Leitura operacional

| Método | Path | Notes |
|--------|------|-------|
| `GET` | `/admin/ops/summary` | Totais: tenants active, outreach enabled, leads no pool, etc. |
| `GET` | `/admin/tenants/:tenantId/leads/stats` | Contagens `TenantLead`: contacted / replied / quoted / closed / deleted |
| `GET` | `/admin/leads/count` | Pool global `Lead` (não deleted) |

Drill-down de leads individuais: fora do MVP (wave 2).

### 5. Contratos / DTOs

- DTOs com class-validator (ou padrão já usado no monorepo) + `@ApiProperty` no Swagger
- Respostas: não expor `password`; users retornam sem hash
- Erros: `401` sem/inválido token; `403` sem role; `404` tenant/user inexistente; `400` validação (phone missing ao enable, etc.)

### 6. Fora do backend desta etapa

| Item | Motivo |
|------|--------|
| Qualquer frontend / SPA / páginas HTML de admin | Escopo explícito: etapa só API |
| Impersonate | Perigoso; precisa audit |
| Cities / Neighborhoods / ScrapeJob | Captura — change à parte |
| Auth nos workers captura/notifly | Não é o painel; ver `03` |
| Remover hardcode captura `tenantId: 4` | Change à parte |
| Baileys management | Legado |
| Billing / Stripe | Fora |
| Audit log dedicado | Nice; description em coin cobre mínimo |
| Editor de templates Meta | Templates vivem na Meta; API só guarda o **nome** |

---

## Fluxo de onboarding via API (sem SQL)

```
1. POST /auth/login                         → token SUPER_ADMIN
2. POST /admin/tenants                      → { name, phone }
3. POST /admin/tenants/:id/users            → admin do tenant
4. POST /admin/tenants/:id/coins/credit     → saldo inicial nesse user
5. PUT  /admin/tenants/:id/outreach-config  → enabled + pricing + templates + schedule
6. (raro) PATCH /admin/whatsapp-accounts/:id
7. Runtime notifly no próximo cron          → sem deploy
```

Testável só com Swagger + DB.

---

## Dependências / riscos

1. Sem esses endpoints, “painel” continua sendo seed/SQL.
2. Captura hardcoded (`03`) — API no gym não corrige.
3. `SUPER_ADMIN` + `tenantId` obrigatório → tenant plataforma.
4. Email unique global trava mesmo e-mail em dois tenants.
5. Débito notifly via `findFirst` user — crédito deve ir na carteira “certa”.
6. Workers sem auth — fora desta etapa.
7. Token Meta nunca no DB.
8. Bootstrap do primeiro super admin: seed one-shot (chicken-egg).

---

## Critérios de aceite (backend)

- [ ] Enum `Roles` inclui `SUPER_ADMIN`; seed cria tenant plataforma + user bootstrap
- [ ] Login desse user retorna JWT com `SUPER_ADMIN`
- [ ] Todos os `/admin/*` exigem JWT + role; `ADMIN` de tenant recebe 403
- [ ] CRUD tenant (incl. `active`) sem SQL
- [ ] Criar admin do tenant + reset password sem SQL
- [ ] Credit/debit coin com `CoinTransaction` sem SQL
- [ ] Upsert `TenantOutreachConfig` (toggle `enabled`) sem SQL
- [ ] Listar/editar `WhatsappAccount` plataforma sem expor/armazenar token
- [ ] Stats de funil + summary operacional
- [ ] Tenant novo com phone + config enabled + saldo aparece no cron do notifly sem deploy
- [ ] Swagger documenta os endpoints admin com Bearer auth
- [ ] **Nenhum** frontend entregue nesta etapa

---

## Perguntas ainda abertas (proposta fecha)

1. Coluna `Tenant.active` neste change ou só `outreachConfig.enabled`?
2. Remover `email @unique` global neste change?
3. Endpoint `POST /admin/platform-users` no MVP ou só seed de um super admin?
4. Atalho `POST .../onboard` monólito vs sequência de endpoints?
5. Prefixo `/admin` vs `/platform`?

---

## Próximo passo

```
/opsx-propose painel-super-admin
```

ou `/opsx-propose-v2` para tasks prontas para subagents.

Insumos:

- Este arquivo (backend-only, 2026-08-05)
- `03-avaliacao-multi-tenant.md`
- `04-avaliacao-banco-dados.md`
- `openspec/changes/archive/2026-08-04-operationalize-tenant-outreach/`
- `prisma/schema.prisma`, `prisma/seed-outreach.ts`
- `apps/gym-ctrl/src/modules/auth.*`, `libs/guard/`, `libs/decorators/roles.decorator.ts`
- `apps/notifly/src/leads.service.ts`, `platform-whatsapp.service.ts`
