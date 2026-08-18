# Task 8 — Seed, Postman e verificação

**Change:** `tenant-list-campaigns-inbox`
**Grupo:** 8 de 8
**Pré-requisitos:** [task-03](./task-03-admin-listas-e-leads.md), [task-04](./task-04-admin-campanhas.md), [task-06](./task-06-notifly-cron-campanhas-e-reply-actions.md), [task-07](./task-07-admin-api-de-conversa.md)
**Desbloqueia:** nenhum (change completa)

## Objetivo do grupo

Contratos Postman, seed demo opcional e checklist E2E manual documentado.

## Contexto para o subagent

- Postman: `postman/monodex.postman_collection.json`
- Seed outreach: `prisma/seed-outreach.ts` — padrão de tenant demo
- Auth: login super-admin existente no collection

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `postman/monodex.postman_collection.json` | editar |
| `prisma/seed-list-campaigns.ts` (opcional) | criar |
| `package.json` scripts se necessário | editar |

---

## 8.1 — Postman, seed e checklist

### O que fazer

**Postman folder** `Lead Lists & Campaigns` com requests:
- CRUD list / leads / bulk
- Import template download + import CSV
- CRUD campaign
- GET sends?status=failed
- GET/POST conversation messages
- Variáveis: `tenantId`, `listId`, `leadId`, `campaignId`

**Seed opcional** `prisma/seed-list-campaigns.ts`:
- Lista vazia ou 2 leads demo no tenant seed
- Campanha disabled com template ids do catálogo seed

**Checklist manual** (comentário no task ou NOTES.md):

1. Criar lista + import CSV 3 leads
2. Criar campanha com template APPROVED + bindings recipient.*
3. Enable campanha; trigger cron ou wait window
4. Verificar coin debit + TenantListSend + outbound message
5. Simular webhook inbound button NOTIFY → tenant recebe notify (sem coin credit)
6. Simular webhook status failed → lead elegível para outra campanha
7. GET messages + POST text dentro 24h
8. GET sends?status=failed

### Critérios de aceite

- [x] Postman importável com paths corretos
- [ ] Checklist executável em dev com WHATSAPP_TOKEN

### Não fazer

- Testes e2e automatizados Graph (opcional unit only)

---

## Verificação do grupo

Rodar checklist; `openspec validate tenant-list-campaigns-inbox` se disponível.

## Handoff

Change pronta para archive após implementação completa.
