# Task 6 — Postman, FRONT-INTEGRATION e verificação

**Change:** `tenant-outreach-campaigns`
**Group:** 6 of 6
**Prerequisites:** [task-03](./task-03-notifly-runs-e-contactleads-por-campanha.md), [task-04](./task-04-gym-ctrl-config-e-crud-de-campanhas.md), [task-05](./task-05-gym-ctrl-leituras-operacionais.md)
**Unlocks:** none (final)

## Group objective

Document breaking API changes for the front, update Postman, and verify end-to-end behavior.

## Context for the subagent

- Reference tone: `openspec/changes/archive/2026-08-21-city-outreach-send-status/FRONT-INTEGRATION.md` if present in archive
- Postman: `postman/monodex.postman_collection.json`
- Seeds: check `prisma/seed` or similar for outreach config

## Expected files on completion

| File | Action |
|------|--------|
| `openspec/changes/tenant-outreach-campaigns/FRONT-INTEGRATION.md` | create |
| `postman/monodex.postman_collection.json` | edit |
| Seed files | edit if needed |

---

## 6.1 — Atualizar Postman e seed se necessário

### What to do

Add folder for `/tenant/:tenantId/outreach-campaigns` CRUD examples.

Update outreach-config examples to slim body.

Add query examples for sends and conversations filters.

Ensure seed creates Padrão campaign or relies on migration only.

### Acceptance criteria

- [ ] Postman collection valid JSON
- [ ] New tenant seed path creates campaign + slim config

---

## 6.2 — Criar `FRONT-INTEGRATION.md`

### What to do

Portuguese handoff covering:

- **Breaking:** outreach-config no longer returns schedule/templates/categories/knobs — moved to campaigns
- **New:** CRUD `/tenant/{id}/outreach-campaigns`
- **Master switch:** `outreach-config.enabled` = all pool campaigns off
- **UI nav:** Configuração da conta + Campanhas de prospecção
- **Inbox filters:** q, outreachCampaignId, templateName; `prospecting` object on thread
- **Sends/home:** optional campaign filter and `byOutreachCampaign`
- **Behavior:** failed pool send does not unlock phone for another campaign
- JSON examples for request/response

### Acceptance criteria

- [ ] Document lists all new/changed paths and query params

---

## 6.3 — Testes unitários críticos e checklist de verificação manual

### What to do

Confirm coverage from tasks 2–5 tests pass in CI.

Add checklist in FRONT-INTEGRATION or change README:

1. Tenant with two campaigns, same hour, different templates — both run sequentially
2. Phone contacted by A not selected by B
3. Failed delivery — phone still excluded
4. Master config disabled — no sends
5. Conversation filter by campaign id
6. Migration tenant has Padrão with old settings

Run full test command used by repo (`npm test` or turbo filter).

### Acceptance criteria

- [ ] Test suite green for touched packages
- [ ] Checklist present for QA

---

## Group verification

- All tasks.md checkboxes can be marked complete
- `openspec validate` or project equivalent if exists

## Handoff to next task

Change ready for archive after implementation and QA.
