# NOTES — painel-super-admin (Task 06 E2E)

Verificação HTTP em `http://localhost:3001` (gym-ctrl prod build) com `NODE_ENV=development`.

Credenciais platform: seed `platform-admin@local.dev` / `platform-admin-dev` (JWT `roles: ["SUPER_ADMIN"]`).

## 6.1 Ops endpoints

| Endpoint | Resultado |
|----------|-----------|
| `GET /admin/ops/summary` | `200` → `{ totalTenants, activeTenants, outreachEnabledTenants, totalLeads }` |
| `GET /admin/tenants/:tenantId/leads/stats` | `200` → `{ contacted, replied, quoted, closed, deleted }`; `404` se tenant inexistente |
| `GET /admin/leads/count` | `200` → `{ count }` com `deletedAt: null` apenas |

Evidência soft-delete: lead criado e marcado `deletedAt` → count ativo permanece 0 enquanto `lead.count()` total = 1. Após seed de `TenantLead` com flags `contacted`/`replied`, stats do tenant 12 = `{ contacted:1, replied:1, quoted:0, closed:0, deleted:0 }`.

## 6.2 Swagger

- UI `/api` → `200`
- OpenAPI `/api-json`: 16 paths admin; security scheme `bearer` (JWT); todos os ops com `@ApiOperation` summary; tags `Admin — Ops` etc.
- Fluxo onboarding executável via Authorize + endpoints documentados (validado por curl equivalente ao Swagger Bearer).

## 6.3 Onboarding sem SQL (tenant id=12)

| Passo | HTTP |
|-------|------|
| Login SUPER_ADMIN | 201 |
| `POST /admin/tenants` (phone) | 201 |
| `POST .../users` ADMIN | 201 (sem `password` na response) |
| `POST .../coins/credit` amount=25 | 201 (`bySuperAdmin:1` na description) |
| `PUT .../outreach-config` enabled=true | 200 |
| `GET /admin/ops/summary` | 200; `outreachEnabledTenants` 2 → 3 |
| `GET .../leads/stats` | 200 |
| `GET /admin/whatsapp-accounts` (opcional) | 200 |

Nenhum SQL manual além do seed bootstrap da Task 1. Sem envio Meta real.

## 6.4 Isolamento role

Com JWT do ADMIN do tenant criado:

- `GET /admin/health`, `/admin/ops/summary`, `/admin/leads/count`, `/admin/tenants`, `/admin/tenants/12`, `/admin/tenants/12/leads/stats`, `/admin/whatsapp-accounts` → **403**

Sem token: mesmos paths → **401**

## Compile

`npm run gym:build` → webpack compiled successfully.
