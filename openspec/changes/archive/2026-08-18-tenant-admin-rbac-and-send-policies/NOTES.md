# Task 08 — NOTES

## Janela de 30 minutos

Neste ambiente a config operacional do tenant id=2 já estava fora da janela (`createdAt` antigo). HTTP comprovou:

- `PATCH /platform/tenants/2/outreach-config` `{ "leadsPerRun": 7 }` → **403**
- `PATCH /platform/tenants/2/outreach-config` `{ "costPerLead": <valor atual> }` → **200**

Não foi necessário `UPDATE tenant_outreach_configs SET created_at = ...`. Em um tenant recém-criado, para forçar o 403 sem esperar 30 min: `UPDATE tenant_outreach_configs SET created_at = NOW() - INTERVAL '31 minutes' WHERE tenant_id = <id>;`

## Item 9 (exclusividade)

E2E Graph (seleção real de `contactLeads` + envio Meta) não foi exigido. Coberto por `libs/shared/send-policy.spec.ts` — caso `Y contacted P; X respeita Y → P excluído`.

## Item 5 (cron inativo)

HTTP comprovou GET outreach 200 e POST lista 403 com `active=false`. Skip do cron de cidade/lista não foi observado em processo notifly (servidor não estava no checklist). Evidência de código: `apps/notifly/src/leads.service.ts` (`where: { active: true }`) e `apps/notifly/src/list-campaigns.service.ts` (`if (!tenant.active)`).

## Seeds locais desta verificação

- `TENANT_ID=2 npx ts-node prisma/seed-outreach.ts` (re-run idempotente: grants id 1 e 2, policy vazia, WhatsappAccount id=1 preservado)
- Tenants HTTP E2E criados: id 3 e 4 (`E2E A/B task08e2e`). Podem ser desativados ou apagados à mão se não forem desejados.
