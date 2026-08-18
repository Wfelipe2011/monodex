# Task 7 — Runtime notifly

**Change:** `tenant-admin-rbac-and-send-policies`
**Grupo:** 7 de 8
**Pré-requisitos:** [Task 1](./task-01-schema-e-migration.md), [Task 2](./task-02-guards-e-helpers-de-autorizacao.md)
**Desbloqueia:** [Task 8](./task-08-postman-seeds-e-verificacao.md)

## Objetivo do grupo

City outreach respeita `Tenant.active`, cidade XOR e exclusividade por telefone `contacted=true` (histórico). Lista CSV não usa essas políticas; skip se inativo ou `costPerSend<=0`.

## Contexto para o subagent

- City outreach: `apps/notifly/src/leads.service.ts`
  - `handleCron` `findMany` where `outreachConfig.enabled` e phone não vazio — **adicionar `active: true`**.
  - `contactLeads` (~175): `usedPhones` de **todos** `TenantLead` do tenant (não só contacted). Manter isso. **Além:** excluir phones contacted de outros conforme policy.
  - `findMany` Lead `where` hoje: `deletedAt: null`, category filter, phone `notIn` used. **Adicionar** `cityId` in/notIn.
- Funções: `excludeUsedPhones`, `uniqueByPhone` em `apps/notifly/src/premium-mix.ts` — reusar para o set extra.
- List cron: `apps/notifly/src/list-campaigns.service.ts` `handleCron` `where: { enabled: true }`; `runCampaign` **já** retorna se `costPerSend <= 0` (linhas 87–92). Adicionar skip se `campaign.list.tenant.active === false` (tenant já vem em `CAMPAIGN_INCLUDE` `list.tenant`).
- Incluir `sendPolicy` + carregar `TenantRespect` e tenants `exclusive` no cron de cidade.
- Specs: `cloud-outreach-runtime`, `tenant-send-policies`.
- Não mudar captura.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/notifly/src/leads.service.ts` | editar |
| `apps/notifly/src/list-campaigns.service.ts` | editar |
| `libs/shared/send-policy.ts` | reusar |
| `apps/notifly/src/send-policy-select.spec.ts` ou testes no shared | criar/editar |

---

## 7.1 — Skip active=false

### O que fazer

`leads.service.ts` `handleCron` where: `active: true`.

`list-campaigns.service.ts` `runCampaign`: se `!tenant.active` log + return (antes de debitar).

### Critérios de aceite

- [ ] Tenant inativo não entra no loop de `contactLeads`
- [ ] Campanha enabled de tenant inativo não envia

### Não fazer

- Não usar `outreach.enabled` como substituto de `active`

---

## 7.2 — Cidade + exclusividade em contactLeads

### O que fazer

1. Load policy (default vazio se null).
2. `cityAllowed` → `where.cityId` `{ in: allowed }` ou `{ notIn: denied }` ou omitir.
3. Phones a excluir além de `usedPhones`:
   - Pairwise: `TenantLead` where `contacted: true`, `tenantId in respectTenantIds`, select `lead.phone`.
   - Se `respectAllTenants`: contacted de `tenantId not tenant.id`.
   - Todos os tenants com `exclusive: true` e `id != self`: phones contacted.
4. União em `Set`; `notIn` no `Lead.phone` (cuidado com lista vazia Prisma).
5. Retroativo: sem filtro `createdAt` na policy.

Não aplicar a `TenantListLead`.

### Critérios de aceite

- [ ] Allowlist city 1 não seleciona city 2
- [ ] Y contacted phone P; X respeita Y → X não seleciona P em outra cidade
- [ ] `exclusive` em Y bloqueia X sem edge

### Não fazer

- Não excluir por `Lead.id` só
- Não mudar mix premium além do pool já filtrado

---

## 7.3 — Lista ignora políticas de cidade/exclusividade

### O que fazer

Não ler `TenantSendPolicy` em `ListCampaignsService.runCampaign`. Garantir skip `costPerSend <= 0` permanece.

### Critérios de aceite

- [ ] Nenhuma query `tenantSendPolicy` / `tenantRespect` no serviço de lista

### Não fazer

- Não filtrar CSV por `cityId`

---

## 7.4 — Testes

### O que fazer

Estender `libs/shared/send-policy.spec.ts` com casos: respectAll ∪ exclusive ∪ pairwise; allow vs deny. Se extração de query for difícil, testar só as funções puras usadas em 7.2.

### Critérios de aceite

- [ ] Jest verde nos specs novos/alterados

### Não fazer

- Não exigir teste e2e Meta

---

## Verificação do grupo

Com policy vazia, comportamento de seleção igual ao atual (só used phones próprios + categoria). Com allowlist, SQL/cidade restringe.

## Handoff para próxima task

Grupo 8 pode montar cenário de dois tenants e `contacted=true` sem chamar Graph se mockar seleção; E2E HTTP cobre API, runtime pode ser raciocínio + unit.
