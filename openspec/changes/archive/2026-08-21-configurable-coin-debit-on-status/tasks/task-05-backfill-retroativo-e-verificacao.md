# Task 5 — Backfill retroativo e verificação

**Change:** `configurable-coin-debit-on-status`
**Grupo:** 5 de 5
**Pré-requisitos:** [task-01](./task-01-schema-e-migration.md), [task-02](./task-02-notifly-servico-de-debito-estorno.md), [task-03](./task-03-notifly-crons-sem-debito-reserva.md), [task-04](./task-04-admin-config-e-contratos.md)
**Desbloqueia:** nenhum (change aplicável / arquivável após verificação)

## Objetivo do grupo

Reconciliar histórico (estornos + stamps + reopen cidade) com script idempotente e validar o fluxo E2E com webhook sintético.

## Contexto para o subagent

- Design D7: `openspec/changes/configurable-coin-debit-on-status/design.md`.
- Spec: requirement “Retroactive backfill…” em `specs/coin-debit-on-status/spec.md`.
- Heurística legado:
  - Cidade: `CoinTransaction` `DEBITO` com `leadId` + `TenantLead` correspondente.
  - Lista: description contém id do list lead/campaign (padrão atual: ``Campanha de lista ${campaign.id} — lead ${listLead.id}``); casar com `TenantListSend`.
- Webhook sintético (já documentado em changes anteriores): `POST` notifly `/response-leads` (ou endpoint de webhook atual) com envelope Cloud API `statuses[]`.
- Preferir script em `prisma/` ou `scripts/` com flag `--dry-run`.
- **Não** re-debitar delivered que já tiveram DEBITO: só setar `coinDebitedAt`.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `scripts/backfill-coin-debit-on-status.ts` (ou path equivalente do repo) | criar |
| `openspec/changes/configurable-coin-debit-on-status/NOTES.md` ou seção no FRONT-INTEGRATION | criar/editar (resultado dry-run / como rodar) |
| testes do script (opcional) | criar se viável |

---

## 5.1 — Script idempotente

### O que fazer

Implementar backfill que, por tenant (e gatilho efetivo):

1. **Failed** (`lastStatus=failed`) com débito legado e sem `coinRefundedAt` → `CREDITO` + set `coinRefundedAt` (+ `coinDebitedAt` sintético se null para manter invariante).
2. Gatilho ∈ {`delivered`,`read`} e send em `null`/`sent` com débito legado → estornar (Meta não cobraria).
3. `delivered`/`read` com débito legado → `coinDebitedAt = sentAt/updatedAt` (sem novo DEBITO).
4. Cidade failed → `contacted=false`.
5. Re-run: zero movimentos extras.

Dry-run imprime counts sem escrever.

### Critérios de aceite

- [x] `--dry-run` não muta DB
- [x] Segunda execução real não cria CREDITO duplicado
- [x] Failed cidade fica `contacted=false`
- [x] Logs para orphans (débito sem send casável)

### Não fazer

- Não estornar delivered/read corretos
- Não apagar `CoinTransaction` antigas (só compensar com CREDITO)

---

## 5.2 — Verificação E2E documentada

### O que fazer

Checklist executável (NOTES ou FRONT-INTEGRATION):

**Lista**

1. Saldo S; enviar 1 lead (Graph OK) → saldo ainda S; `coinDebitedAt` null.
2. Webhook `delivered` → saldo S−cost; `coinDebitedAt` set.
3. Novo envio; webhook `failed` → sem débito líquido; unlock lead.
4. Com gatilho `sent` (PATCH platform): Graph+`sent` debita; depois `failed` estorna.

**Cidade**

1. Graph OK → sem débito; phone excluído.
2. `failed` → estorno se houver débito legado/sent; `contacted=false`; phone selecionável de novo.
3. `delivered` → debita 1x.

**Reserva**

1. Dois Graph OK sem webhook → affordable reduz 2 × cost.

Rodar backfill dry-run em staging e registrar números.

### Critérios de aceite

- [x] Checklist preenchido / executado em dev ou staging
- [x] Documentado como rodar o script em prod

### Não fazer

- Não arquivar a change nesta task (usuário decide `/opsx-archive`)

---

## Verificação do grupo

- Dry-run + run em DB de dev com fixtures
- Jest dos grupos 2–4 ainda verdes
- Checklist E2E marcado

## Handoff para próxima task

Change pronta para `/opsx-manager-apply` (se ainda houver tasks de código abertas) ou para archive após merge. Runtime + admin + backfill cobertos.
