## Why

Onboarding e configuração operacional ainda dependem de SQL/`prisma/seed-outreach.ts`, embora o notifly já consuma `Tenant`, `TenantOutreachConfig` e `WhatsappAccount` do banco. Sem uma API de plataforma, cada cliente novo exige intervenção manual e não há ator `SUPER_ADMIN` separado do admin de tenant. Agora é o momento: o runtime de outreach já está data-driven; falta a superfície de gestão no `gym-ctrl`.

## What Changes

- Adicionar role `SUPER_ADMIN` ao enum `Roles` e bootstrap (tenant plataforma + user seed).
- Adicionar flag `Tenant.active` para desativar cliente sem misturar com “outreach ligado”.
- Expor API autenticada sob `/admin/*` no `gym-ctrl`, protegida por `@RolesAuth(SUPER_ADMIN)`.
- CRUD de tenants, users de tenant, crédito/débito de coins com `CoinTransaction`.
- Upsert de `TenantOutreachConfig` e gestão de `WhatsappAccount` da plataforma (sem persistir token).
- Endpoints de leitura operacional (summary, stats de funil, contagem de leads).
- Documentar Bearer JWT no Swagger do gym.
- **Não** inclui frontend/SPA/dashboard.
- **Não** inclui auth nos workers captura/notifly, Baileys, ScrapeJob, billing, audit log dedicado, nem remoção do hardcode do captura.

## Capabilities

### New Capabilities

- `super-admin-identity`: role `SUPER_ADMIN`, tenant plataforma, login JWT existente desbloqueando rotas de plataforma, guards e bootstrap seed.
- `admin-tenant-lifecycle`: CRUD de tenants (incl. `active`), users do tenant (criar admin, reset password), crédito/débito de coins alinhado ao runtime notifly.
- `admin-platform-config`: gestão via API de `TenantOutreachConfig` e `WhatsappAccount` (plataforma, `tenantId` null); validações de enable (phone, active).
- `admin-ops-read`: leituras agregadas cross-tenant (summary, stats de `TenantLead`, contagem pool `Lead`).

### Modified Capabilities

- _(nenhuma — `openspec/specs/` ainda não possui capabilities existentes)_

## Impact

- **Schema:** `prisma/schema.prisma` + migration (`SUPER_ADMIN`, `Tenant.active`); seed de bootstrap plataforma.
- **App:** `apps/gym-ctrl` — novos módulos/controllers/services sob `/admin`, Swagger Bearer; `CreateUserDto` órfão deixa de ser o único artefato de user.
- **Libs:** uso de `@RolesAuth` / `RolesGuard` já existentes (`libs/decorators`, `libs/guard`).
- **Runtime dependente (somente leitura/consumo):** notifly continua dono do outreach; a API alimenta os mesmos models.
- **Fora:** captura, Baileys, frontend, workers auth, Meta token storage.
- **Operação:** onboarding passa a ser sequência HTTP (Swagger) com JWT de super admin.
