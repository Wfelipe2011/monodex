# Tasks — painel-super-admin

| Grupo | Arquivo de detalhes |
|-------|---------------------|
| 1 | [task-01-schema-e-bootstrap-de-identidade.md](./tasks/task-01-schema-e-bootstrap-de-identidade.md) |
| 2 | [task-02-fundacoes-do-modulo-admin-no-gym-ctrl.md](./tasks/task-02-fundacoes-do-modulo-admin-no-gym-ctrl.md) |
| 3 | [task-03-api-de-tenants-e-users.md](./tasks/task-03-api-de-tenants-e-users.md) |
| 4 | [task-04-api-de-coins.md](./tasks/task-04-api-de-coins.md) |
| 5 | [task-05-api-de-config-de-plataforma-outreach-whatsapp.md](./tasks/task-05-api-de-config-de-plataforma-outreach-whatsapp.md) |
| 6 | [task-06-leitura-operacional-e-verificacao.md](./tasks/task-06-leitura-operacional-e-verificacao.md) |

**Ordem de execução:** 1 → 2 → 3 → (4 ∥ 5) → 6  
(Grupos 4 e 5 podem rodar em paralelo após 3.)

**Artefatos de contexto:** [proposal.md](./proposal.md) · [design.md](./design.md) · [specs/](./specs/)

---

## 1. Schema e bootstrap de identidade

📄 [Detalhes](./tasks/task-01-schema-e-bootstrap-de-identidade.md)

- [x] 1.1 Adicionar `SUPER_ADMIN` ao enum `Roles` e `active Boolean @default(true)` em `Tenant` no `schema.prisma`
- [x] 1.2 Criar e aplicar migration Prisma correspondente
- [x] 1.3 Criar seed idempotente de tenant plataforma + user `SUPER_ADMIN` (env `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD`)
- [x] 1.4 Verificar login `POST /auth/login` retorna JWT com `SUPER_ADMIN`

## 2. Fundações do módulo admin no gym-ctrl

📄 [Detalhes](./tasks/task-02-fundacoes-do-modulo-admin-no-gym-ctrl.md)

- [x] 2.1 Criar `AdminModule` e registrar em `GymModule`
- [x] 2.2 Configurar Swagger Bearer JWT (`addBearerAuth` + `@ApiBearerAuth` nos controllers admin)
- [x] 2.3 Garantir que controllers admin usam `@RolesAuth(Roles.SUPER_ADMIN)` (não `@Public`)
- [x] 2.4 Smoke: `ADMIN` de tenant recebe 403 em `/admin/*`; sem token 401

## 3. API de tenants e users

📄 [Detalhes](./tasks/task-03-api-de-tenants-e-users.md)

- [x] 3.1 Implementar CRUD tenants: `GET/POST /admin/tenants`, `GET/PATCH /admin/tenants/:id` (incl. `active`)
- [x] 3.2 Implementar list/create/patch users e reset-password sob `/admin/tenants/:tenantId/users`
- [x] 3.3 Rejeitar roles contendo `SUPER_ADMIN` nos endpoints de tenant user
- [x] 3.4 Hash bcrypt nas senhas; nunca retornar `password` nas responses

## 4. API de coins

📄 [Detalhes](./tasks/task-04-api-de-coins.md)

- [x] 4.1 `GET /admin/tenants/:tenantId/coins` e `GET .../coin-transactions`
- [x] 4.2 `POST .../coins/credit` e `POST .../coins/debit` com `CoinTransaction` e validação de saldo
- [x] 4.3 Incluir marcador do operador em `description` (ex. `bySuperAdmin:{id}`)

## 5. API de config de plataforma (outreach + WhatsApp)

📄 [Detalhes](./tasks/task-05-api-de-config-de-plataforma-outreach-whatsapp.md)

- [x] 5.1 `GET/PUT/PATCH /admin/tenants/:tenantId/outreach-config` espelhando `TenantOutreachConfig`
- [x] 5.2 Validar `enabled=true` exige `Tenant.phone` útil e `Tenant.active === true`
- [x] 5.3 `GET/POST /admin/whatsapp-accounts` e `GET/PATCH .../:id` só para `tenantId` null
- [x] 5.4 Nunca aceitar/retornar token Meta; só `tokenEnvKey` e campos não secretos

## 6. Leitura operacional e verificação

📄 [Detalhes](./tasks/task-06-leitura-operacional-e-verificacao.md)

- [x] 6.1 `GET /admin/ops/summary`, `GET /admin/tenants/:tenantId/leads/stats`, `GET /admin/leads/count`
- [x] 6.2 Documentar no Swagger todos os endpoints admin
- [x] 6.3 Checklist manual: onboarding completo via API (tenant → user → credit → outreach config) sem SQL
- [x] 6.4 Confirmar que tenant `ADMIN` continua sem acesso a `/admin/*`
