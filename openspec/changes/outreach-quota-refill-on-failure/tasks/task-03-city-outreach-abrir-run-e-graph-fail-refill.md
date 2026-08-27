# Task 3 — City outreach — abrir run e Graph-fail refill

**Change:** `outreach-quota-refill-on-failure`
**Grupo:** 3 de 6
**Pré-requisitos:** [1](./task-01-schema-e-migration.md), [2](./task-02-servico-de-run-e-refill-notifly.md)
**Desbloqueia:** [6](./task-06-verificacao-e-handoff.md)

## Objetivo do grupo

`contactLeads` passa a abrir um run city, contar tries/accepts, linkar `TenantLead.runId`, e em falha Graph (sem wamid) disparar um `refillOne` com intervalo e mix premium.

## Contexto para o subagent

- Arquivo principal: `apps/notifly/src/leads.service.ts` — método `contactLeads` (~L259), loop ~L408–483.
- Hoje: batch fixo `selectStratifiedBatch`; `catch` só loga.
- Exclusão de phones: `cityUsedPhonesWhere` em `coin-reservation.ts` (failed não exclui globalmente — OK; exclusão **no run** é extra no refill).
- Credenciais: `platformWhatsapp.resolveCredentials`.
- Specs: `../specs/cloud-outreach-runtime/spec.md`, `../specs/outreach-send-run/spec.md`, `../specs/premium-lead-mix/spec.md`.
- Design D5: fase inicial para de tentar quando `graphAcceptsThisTick >= target` (não esperar charged); deixa run OPEN para webhook.
- Injetar `OutreachSendRunService` + `OutreachQuotaRefillService`.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/notifly/src/leads.service.ts` | editar |
| `apps/notifly/src/leads.service.spec.ts` (se existir) ou novo spec focado | editar/criar |
| `apps/notifly/src/notifly.module.ts` | editar se DI precisar |

---

## 3.1 — Abrir run e linkar accepts

### O que fazer

No início de `contactLeads` (após affordable > 0):

1. `close` TTL city runs expirados do tenant.
2. `openCityRun({ tenantId, targetCount: config.leadsPerRun })`; se `null` → log skip e return.
3. Montar pool/mix como hoje, mas o loop deve obter até `min(target, affordable, pool)` **accepts**, usando `beginTry` antes de cada POST.
4. Em Graph 200: criar `TenantLead` com `runId`, `wasPremium` se coluna existir, `recordAccept`.
5. Não fechar run no fim do tick só porque o batch acabou — deixar OPEN para webhook catch-up (exceto EXHAUSTED se pool vazio e accepts < target e tries esgotáveis).

### Critérios de aceite

- [ ] Todo city accept do tick tem `runId`
- [ ] Segundo cron com run OPEN não abre outro batch

### Não fazer

- Não debitar coins no Graph accept

---

## 3.2 — Graph-fail → refillOne

### O que fazer

Quando POST falha ou binding skip sem wamid **após** `beginTry`:

- Aguardar `sendIntervalSeconds`
- Chamar `refillOne` com `failedPhone` do lead tentado e `wasPremium`
- Para skip de binding **antes** de beginTry: ou não contar try, ou contar — preferir **não** `beginTry` até imediatamente antes do POST

Se o loop ainda tem slots pré-selecionados, continuar; refill é **além**/em substituição do slot perdido conforme design (one event → one refill). Na prática após fail do lead i, `refillOne` tenta um novo; o for continua nos restantes do batch planejado. Alternativa limpa (preferida no design): abandonar for-fixixo e usar while baseado em accepts/try — desde que não dispare N refills por um fail.

**Preferência:** while `accepts < target && beginTry allowed && pickLead()`; on fail, continue while (próximo pick = refill natural). Isso unifica Graph-fail refill com o loop sem chamar `refillOne` no catch — **mas** o produto pediu `refillOne` também no webhook. Para Graph-fail, o while já repõe. Garantir que Graph-fail **não** deixa de repor.

Se usar while unificado no cron, `refillOne` fica principalmente para webhook; Graph-fail = continue loop. Documentar no código. Spec exige refill após Graph fail — while satisfaz.

### Critérios de aceite

- [ ] Falha Graph no tick ainda permite chegar a `target` accepts se pool/saldo/try cap permitirem
- [ ] Intervalo respeitado entre POSTs

### Não fazer

- Não reutilizar o mesmo phone no mesmo run após fail

---

## 3.3 — Premium snapshot e testes

### O que fazer

- Ao selecionar lead, saber se é premium (`isPremium(...)`).
- Em fail/refill, preferir outro premium.
- Testes: mock HTTP fail no 2º lead → ainda 5 accepts se pool grande; premium fail → próximo premium.

### Critérios de aceite

- [ ] Cenários premium da spec cobertos por teste
- [ ] Testes existentes de contactLeads não quebram sem atualização justificada

### Não fazer

- Não mudar regras globais de `isPremium`

---

## Verificação do grupo

- Unit/integration tests city path; logs mostram run id.

## Handoff para próxima task

List campaigns espelham o padrão; webhook (grupo 5) usa o mesmo `refillOne` / run counters.
