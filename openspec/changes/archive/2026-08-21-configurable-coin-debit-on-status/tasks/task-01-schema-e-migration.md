# Task 1 — Schema e migration

**Change:** `configurable-coin-debit-on-status`
**Grupo:** 1 de 5
**Pré-requisitos:** nenhum
**Desbloqueia:** [task-02](./task-02-notifly-servico-de-debito-estorno.md), [task-03](./task-03-notifly-crons-sem-debito-reserva.md), [task-04](./task-04-admin-config-e-contratos.md), [task-05](./task-05-backfill-retroativo-e-verificacao.md)

## Objetivo do grupo

Persistir o gatilho de cobrança por tenant e timestamps de débito/estorno por envio (cidade e lista), com migration aplicável e seed alinhado.

## Contexto para o subagent

- Schema: `prisma/schema.prisma`.
- `TenantOutreachConfig` (~367): pricing já tem `costPerLead`, `cashbackOnReply`. Adicionar `coinDebitOnStatus` aqui (design D1).
- Enum existente `WhatsappDeliveryStatus` inclui `failed` — **não** reutilizar como tipo do gatilho; criar enum separado sem `failed`.
- `TenantLead` (~150): já tem `lastStatus`, `messageId`, `contacted`.
- `TenantListSend` (~559): já tem `wamid`, `lastStatus`.
- `CoinTransaction` **não** ganha FK obrigatória nesta change.
- Migrations em `prisma/migrations/`; nome sugerido: `YYYYMMDDHHMMSS_configurable_coin_debit_on_status`.
- Seed: `prisma/seed-outreach.ts` (create/update de `TenantOutreachConfig`).
- Não alterar apps notifly/gym-ctrl nesta task (só schema/seed/migration).

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `prisma/schema.prisma` | editar |
| `prisma/migrations/<timestamp>_configurable_coin_debit_on_status/migration.sql` | criar |
| `prisma/seed-outreach.ts` | editar (default explícito ok) |

---

## 1.1 — Enum e campo no config

### O que fazer

Adicionar:

```prisma
enum CoinDebitOnStatus {
  sent
  delivered
  read
}
```

Em `TenantOutreachConfig`:

```prisma
coinDebitOnStatus CoinDebitOnStatus @default(delivered) @map("coin_debit_on_status")
```

### Critérios de aceite

- [ ] Enum sem valor `failed`
- [ ] Default Prisma = `delivered`
- [ ] `npx prisma validate` passa

### Não fazer

- Não colocar o campo em `Tenant` nem em `TenantLeadList`
- Não usar `WhatsappDeliveryStatus` como tipo do gatilho

---

## 1.2 — Timestamps em TenantLead e TenantListSend

### O que fazer

Em ambos os models:

```prisma
coinDebitedAt  DateTime? @map("coin_debited_at")
coinRefundedAt DateTime? @map("coin_refunded_at")
```

### Critérios de aceite

- [ ] Campos nullable em `TenantLead` e `TenantListSend`
- [ ] Mapeamento snake_case nas colunas

### Não fazer

- Não tornar os campos required
- Não adicionar índices compostos nesta task (opcional depois se performance exigir)

---

## 1.3 — Migration e seed

### O que fazer

1. Gerar/aplicar migration (`npx prisma migrate dev --name configurable_coin_debit_on_status` ou SQL equivalente no padrão do repo).
2. Em `seed-outreach.ts`, no create de config, pode omitir o campo (default DB) ou setar `coinDebitOnStatus: 'delivered'` explicitamente.

### Critérios de aceite

- [ ] Migration cria enum + colunas
- [ ] Rows existentes de `tenant_outreach_configs` ficam com `delivered`
- [ ] Seed continua idempotente

### Não fazer

- Não rodar backfill de coins nesta task (grupo 5)
- Não alterar lógica de apps

---

## Verificação do grupo

- `npx prisma validate`
- Migration aplica em DB local sem erro
- `\d tenant_outreach_configs` / inspect mostra `coin_debit_on_status`

## Handoff para próxima task

Schema pronto para o serviço de billing ler `coinDebitOnStatus` e gravar `coinDebitedAt` / `coinRefundedAt`.
