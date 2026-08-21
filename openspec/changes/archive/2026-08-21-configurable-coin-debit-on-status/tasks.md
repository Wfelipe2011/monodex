| Grupo | Arquivo de detalhes |
|-------|---------------------|
| 1 | [task-01-schema-e-migration.md](./tasks/task-01-schema-e-migration.md) |
| 2 | [task-02-notifly-servico-de-debito-estorno.md](./tasks/task-02-notifly-servico-de-debito-estorno.md) |
| 3 | [task-03-notifly-crons-sem-debito-reserva.md](./tasks/task-03-notifly-crons-sem-debito-reserva.md) |
| 4 | [task-04-admin-config-e-contratos.md](./tasks/task-04-admin-config-e-contratos.md) |
| 5 | [task-05-backfill-retroativo-e-verificacao.md](./tasks/task-05-backfill-retroativo-e-verificacao.md) |

**Ordem de execução:** 1 → 2 → 3 → 5; grupo 4 pode rodar em paralelo após 1 (antes ou junto de 2–3). Deploy de runtime exige **2+3 no mesmo release** (evitar double-charge).

**Artefatos de contexto:** [proposal.md](./proposal.md) · [design.md](./design.md) · [specs/](./specs/)

## 1. Schema e migration

📄 [Detalhes](./tasks/task-01-schema-e-migration.md)

- [x] 1.1 Adicionar enum `CoinDebitOnStatus` (`sent` | `delivered` | `read`) e campo `coinDebitOnStatus` em `TenantOutreachConfig` com default `delivered`
- [x] 1.2 Adicionar `coinDebitedAt` e `coinRefundedAt` em `TenantLead` e `TenantListSend`
- [x] 1.3 Gerar e aplicar migration Prisma; atualizar seed de outreach com o default

## 2. Notifly — serviço de débito/estorno

📄 [Detalhes](./tasks/task-02-notifly-servico-de-debito-estorno.md)

- [x] 2.1 Criar serviço compartilhado de billing por status (resolve gatilho, cost, rank, debit/refund idempotentes)
- [x] 2.2 Integrar o serviço em `webhook-persistence.service` após persistir status (cidade e lista)
- [x] 2.3 Em `failed` de cidade: `contacted=false` além do fluxo de estorno
- [x] 2.4 Specs unitários do serviço e extensão de `webhook-persistence.service.spec.ts`

## 3. Notifly — crons sem débito + reserva

📄 [Detalhes](./tasks/task-03-notifly-crons-sem-debito-reserva.md)

- [x] 3.1 Remover débito de coins em `leads.service` `contactLeads` no Graph 200; aplicar reserva de pending no cálculo de affordable
- [x] 3.2 Remover débito em `list-campaigns.service` `sendToLead`; aplicar reserva pending da lista
- [x] 3.3 Ajustar exclusão de phones em cidade para não excluir `lastStatus=failed`
- [x] 3.4 Atualizar/adicionar testes dos crons cobrindo no-debit-on-send e reserva

## 4. Admin — config e contratos

📄 [Detalhes](./tasks/task-04-admin-config-e-contratos.md)

- [x] 4.1 Expor `coinDebitOnStatus` no PATCH platform de outreach config (Super Admin); rejeitar no path tenant Admin
- [x] 4.2 Incluir o campo nas respostas GET de outreach config (platform e tenant read)
- [x] 4.3 Swagger DTOs + Postman + FRONT-INTEGRATION.md desta change

## 5. Backfill retroativo e verificação

📄 [Detalhes](./tasks/task-05-backfill-retroativo-e-verificacao.md)

- [x] 5.1 Script/job idempotente de backfill (failed refund, sent/null refund se gatilho delivered/read, stamp delivered/read, reopen cidade)
- [x] 5.2 Dry-run + execução documentada; checklist de verificação E2E (webhook sintético cidade/lista)
