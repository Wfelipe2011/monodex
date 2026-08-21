## Context

Hoje cidade (`leads.service.contactLeads`) e lista (`list-campaigns.service.sendToLead`) debitam coins na mesma transação do Graph 200. O webhook (`webhook-persistence.service.handleStatus`) só grava `WhatsappSendStatus`, atualiza `lastStatus` e, em lista, faz unlock em `failed`. Cidade em `failed` não reabre telefone: a seleção exclui **qualquer** `TenantLead` do tenant pelo phone, independente de status.

A Meta (modelo per-message) só fatura template em `delivered`. A plataforma precisa cobrar no status configurável por tenant (default `delivered`), estornar quando apropriado, e corrigir histórico.

## Goals / Non-Goals

**Goals:**

- Débito configurável por tenant: `sent` | `delivered` | `read` (default `delivered`).
- Mesma regra para outreach de cidade e campanhas de lista.
- Sem débito no Graph 200; cobrança idempotente no webhook do status gatilho.
- `failed` → nunca fica cobrado (estorno se já debitou); unlock lista; reopen telefone cidade.
- Reserva de saldo para envios aceitos ainda não cobrados / não falhos.
- Backfill retroativo de estornos + reopen.

**Non-Goals:**

- Mudar `costPerLead` / `costPerSend` / cashback de reply.
- Cobrar notify-ao-tenant ou test-send de catálogo.
- UI no monorepo (só API + FRONT-INTEGRATION).
- Contabilidade Meta real-time (não reconciliamos fatura Meta; alinhamos política comercial).

## Decisions

### D1 — Campo `coinDebitOnStatus` em `TenantOutreachConfig`

Enum Prisma espelhando subset de sucesso: `sent` | `delivered` | `read`. Default `delivered`. Ownership: **plataforma** (mesmo eixo de `costPerLead`) — só Super Admin via `PATCH /platform/.../outreach-config`.

**Por quê na outreach config e não em `Tenant`:** já é o lugar de pricing/runtime do tenant; lista lê o mesmo config do `tenantId` da lista. Tenant sem config: default efetivo `delivered` (não bloqueia lista).

**Alternativa rejeitada:** campo por lista — user pediu por tenant; duplicaria UX.

### D2 — Débito no webhook, não no Graph 200

```
Graph 200 → cria send + lock/contacted; NÃO debita
webhook status ≥ gatilho (ordem sent < delivered < read) → debita 1x
webhook failed → estorna se debitado; unlock/reopen; NÃO debita
```

Ordem de progresso: `sent` (1) < `delivered` (2) < `read` (3). Cobrar quando `rank(status) >= rank(gatilho)` e status ≠ `failed`. Assim `read` satisfaz gatilho `delivered` se a Meta pular o evento intermediário.

**Alternativa rejeitada:** cobrar só no status exact match — perde cobrança se Meta enviar só `read`.

### D3 — Idempotência: `coinDebitedAt` / `coinRefundedAt` no envio

Em `TenantLead` e `TenantListSend`:

- `coinDebitedAt DateTime?`
- `coinRefundedAt DateTime?`

Débito: só se `coinDebitedAt IS NULL` e status atingiu gatilho.  
Estorno: só se `coinDebitedAt IS NOT NULL` e `coinRefundedAt IS NULL` e status=`failed`.

`CoinTransaction`: manter type `DEBITO`/`CREDITO`; description inclui `wamid=...` e origem (`city`/`list`); opcionalmente `leadId` na cidade (já existe). Sem FK nova obrigatória nesta change (evita migration pesada); idempotência vive nas colunas do send.

### D4 — Reserva de saldo no cron

`affordable = floor(available / cost)` onde:

```
available = balance - (pendingCount * cost)
pending = envios do tenant com coinDebitedAt IS NULL
          AND coinRefundedAt IS NULL
          AND (lastStatus IS NULL OR lastStatus IN (sent, delivered, read)
               — na prática: lastStatus IS DISTINCT FROM failed)
```

Cidade: count `TenantLead` do tenant. Lista: count `TenantListSend` via campanhas das listas do tenant (e usar `costPerSend` da lista respectiva — reserva por lista no run da campanha).

Para lista no `runCampaign`: pending daquela lista (ou tenant) × `costPerSend`. Preferir pending **da mesma lista** para não misturar preços.

### D5 — Reopen telefone cidade em `failed`

1. `handleStatus` failed em `TenantLead`: unlock semântico — não apagar row (histórico/status permanecem).
2. Alterar exclusão em `contactLeads`: phones “usados” = `TenantLead` do tenant onde `lastStatus IS DISTINCT FROM failed` (inclui `NULL` pendente, `sent`, `delivered`, `read`). `failed` **não** exclui → telefone volta ao pool **deste** tenant.
3. `contacted` pode permanecer `true` para auditoria de tentativa; a seleção passa a depender do critério acima, não só de existência da row.

Exclusividade entre tenants (`TenantSendPolicy` / `contacted: true` em outros tenants) **não** muda nesta change além do efeito colateral: se outro tenant só respeita `contacted: true`, um failed com `contacted=true` ainda pode excluir cross-tenant. Decisão: em failed cidade, setar `contacted=false` **também**, para alinhar policies que filtram `contacted: true`. Row e `lastStatus=failed` / `messageId` permanecem.

### D6 — Serviço compartilhado de billing no notifly

Extrair `CoinDebitOnStatusService` (nome livre) usado por `WebhookPersistenceService`:

- resolve tenant + cost (`costPerLead` vs `costPerSend`)
- resolve gatilho (`coinDebitOnStatus` ou default)
- applyDebitIfDue / applyRefundIfFailed

Crons só deixam de chamar `coin.update` no send.

### D7 — Retroativo (one-shot script ou job admin)

Ordem:

1. Migration schema (campos + default).
2. Script `backfill-coin-debit-on-status.ts` (ou cron one-shot):
   - Para cada `TenantLead` / `TenantListSend` com `lastStatus=failed` e evidência de débito legado sem `coinRefundedAt`: criar `CREDITO` do valor vigente na época se possível, senão `costPerLead`/`costPerSend` atual; set `coinRefundedAt` (e `coinDebitedAt` sintético se necessário para a invariante).
   - Para envios com `lastStatus IN (null, sent)` já debitados (legado) e gatilho tenant ∈ {`delivered`,`read`}: estornar (Meta não cobraria).
   - Para `delivered`/`read` já debitados: set `coinDebitedAt=sentAt/updatedAt` sem novo movimento (marca idempotência).
   - Failed cidade: `contacted=false` + critério de exclusão novo.
3. Rodar em staging → prod com dry-run flag.

Heurística de “já debitado” legado: `CoinTransaction` `DEBITO` com `leadId` (cidade) ou description contendo id do list lead/campaign; se ambíguo, preferir estornar failed óbvios e logar orphans.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Overspend entre Graph e webhook | Reserva `pending × cost` no cron |
| Webhook duplicado | `coinDebitedAt` / `coinRefundedAt` |
| Meta pula `delivered` e manda só `read` | Cobrança por rank ≥ gatilho |
| Gatilho `sent` + depois `failed` | Estorno obrigatório em failed |
| Backfill errado estorna demais | Dry-run + logs; marcar timestamps sem inventar CREDITO se não achar DEBITO |
| Lista retry após failed | Unlock já existe; sem débito no failed + débito só no sucesso posterior |
| Tenant sem `TenantOutreachConfig` | Default `delivered` em código |
| Saldo negativo se refund > expectativa | Estorno só se `coinDebitedAt` set; backfill conservador |

## Migration Plan

1. Prisma migrate: enum + `coinDebitOnStatus` default `delivered` em `TenantOutreachConfig`; colunas de timestamp nos sends/leads.
2. Deploy notifly com billing no webhook **e** ainda sem remover débito no send? → **Não**: cutover atômico no mesmo release (senão double-charge). Ordem no release: (a) migration, (b) código novo (webhook cobra, send não), (c) backfill.
3. Rollback: reverter código para débito-no-send só se backfill não rodou; se já estornou, rollback de código deixa inconsistência — documentar “não rollback após backfill sem intervenção manual”.

## Open Questions

Nenhum bloqueante. Assunções explícitas:

- Um único gatilho por tenant para cidade **e** lista.
- `failed` nunca é valor de `coinDebitOnStatus`.
- Admin tenant **não** edita o gatilho (só Super Admin).
