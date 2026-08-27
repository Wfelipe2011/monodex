| Grupo | Arquivo de detalhes |
|-------|---------------------|
| 1 | [task-01-schema-e-migration.md](./tasks/task-01-schema-e-migration.md) |
| 2 | [task-02-servico-de-run-e-refill-notifly.md](./tasks/task-02-servico-de-run-e-refill-notifly.md) |
| 3 | [task-03-city-outreach-abrir-run-e-graph-fail-refill.md](./tasks/task-03-city-outreach-abrir-run-e-graph-fail-refill.md) |
| 4 | [task-04-list-campaigns-abrir-run-e-graph-fail-refill.md](./tasks/task-04-list-campaigns-abrir-run-e-graph-fail-refill.md) |
| 5 | [task-05-webhook-failed-billing-hooks.md](./tasks/task-05-webhook-failed-billing-hooks.md) |
| 6 | [task-06-verificacao-e-handoff.md](./tasks/task-06-verificacao-e-handoff.md) |

**Ordem de execução:** 1 → 2 → (3 ∥ 4) → 5 → 6

**Artefatos de contexto:** [proposal.md](./proposal.md) · [design.md](./design.md) · specs

## 1. Schema e migration

📄 [Detalhes](./tasks/task-01-schema-e-migration.md)

- [x] 1.1 Adicionar enums e model `OutreachSendRun` no Prisma com counters, TTL e FKs opcionais
- [x] 1.2 Adicionar `runId` nullable em `TenantLead` e `TenantListSend` + `refillTriggeredAt` (ou equivalente) para idempotência
- [x] 1.3 Gerar e revisar migration SQL; aplicar em ambiente local de verificação

## 2. Serviço de run e refill (notifly)

📄 [Detalhes](./tasks/task-02-servico-de-run-e-refill-notifly.md)

- [x] 2.1 Criar `OutreachSendRunService` (open/close/TTL/lock, increment try/attempt/charged)
- [x] 2.2 Criar `OutreachQuotaRefillService.refillOne` com elegibilidade, intervalo e seleção de lead
- [x] 2.3 Testes unitários de caps, TTL, idempotência de refill e exclusão de telefone no run

## 3. City outreach — abrir run e Graph-fail refill

📄 [Detalhes](./tasks/task-03-city-outreach-abrir-run-e-graph-fail-refill.md)

- [x] 3.1 Em `contactLeads`, abrir run (ou skip se já houver OPEN), linkar accepts, contar tries
- [x] 3.2 Em falha Graph / skip sem wamid, aguardar intervalo e chamar `refillOne`
- [x] 3.3 Mix premium: snapshot `wasPremium`; refill premium-preferente; testes de integração/serviço

## 4. List campaigns — abrir run e Graph-fail refill

📄 [Detalhes](./tasks/task-04-list-campaigns-abrir-run-e-graph-fail-refill.md)

- [x] 4.1 Em `runCampaign`, espelhar open/skip/link/tryCount do city
- [x] 4.2 Graph-fail → intervalo → `refillOne` com lead de lista diferente
- [x] 4.3 Testes do serviço de campanha cobrindo refill e cap

## 5. Webhook failed + billing hooks

📄 [Detalhes](./tasks/task-05-webhook-failed-billing-hooks.md)

- [x] 5.1 Após debit em send com `runId`, incrementar `chargedCount` e fechar se target met
- [x] 5.2 Em refund por `failed`, ajustar charged accounting; first-failed → `refillOne` at-most-once
- [x] 5.3 Garantir path async (não bloquear ACK Meta); testes de webhook/billing

## 6. Verificação e handoff

📄 [Detalhes](./tasks/task-06-verificacao-e-handoff.md)

- [x] 6.1 Rodar specs/testes notifly relevantes; checklist manual dos cenários da explore
- [x] 6.2 Atualizar notas de handoff (sem FRONT obrigatório); marcar tasks.md
