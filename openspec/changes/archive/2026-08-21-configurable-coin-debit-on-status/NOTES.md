# NOTES — configurable-coin-debit-on-status (Task 05)

Backfill retroativo + checklist E2E. Runtime/admin já cobertos nas tasks 1–4.

**Não rollback** o código de débito-no-send após o backfill real sem intervenção manual (design — Migration Plan).

---

## Script de backfill

Arquivo: `scripts/backfill-coin-debit-on-status.ts`

### O que faz (idempotente)

| Caso | Ação |
|------|------|
| `lastStatus=failed` + débito legado (ou `coinDebitedAt` set) sem `coinRefundedAt` | `CREDITO` + `coinRefundedAt` (+ `coinDebitedAt` sintético se null) |
| Gatilho efetivo ∈ {`delivered`,`read`} + status `null`/`sent` + débito legado | estorna (Meta não cobraria) |
| `delivered`/`read` (ou `null`/`sent` com gatilho `sent`) + débito legado | só seta `coinDebitedAt` (sem novo `DEBITO`) |
| Cidade `failed` com `contacted=true` | `contacted=false` |
| Re-run | zero `CREDITO`/`DEBITO` extras |

Heurística legado:

- **Cidade:** `CoinTransaction` `DEBITO` com `leadId` = `TenantLead.leadId` (preferência description contendo `contatado`).
- **Lista:** description `Campanha de lista {campaignId} — lead {listLeadId}` casada com `TenantListSend`.

Orphans (débito sem send casável) vão para `stderr` como `[orphan-debit]`.

### Como rodar

```bash
# Dry-run (não muta DB) — staging/prod obrigatório antes do real
npx ts-node scripts/backfill-coin-debit-on-status.ts --dry-run

# Um tenant
npx ts-node scripts/backfill-coin-debit-on-status.ts --tenant-id=8 --dry-run

# Real (após validar counts do dry-run)
npx ts-node scripts/backfill-coin-debit-on-status.ts
# ou
npm run backfill:coin-debit-on-status -- --dry-run
npm run backfill:coin-debit-on-status
```

Requer `DATABASE_URL` no ambiente (`.env` carregado via `dotenv/config`).

### Ordem de release (lembrete)

1. Migration (task 1)  
2. Deploy notifly com billing no webhook **e** send sem débito (tasks 2–3) no **mesmo** release  
3. Backfill dry-run → real  

### Resultado dry-run (dev local — 2026-08-21)

```
[backfill-coin-debit-on-status] start dryRun=true tenantId=ALL
[tenant 1 Platform] trigger=delivered costPerLead=0.35
[tenant 2 Gladson Teixeira] trigger=delivered costPerLead=0.35
[tenant 3 E2E A task08e2e] trigger=delivered costPerLead=0
[tenant 4 E2E B task08e2e] trigger=delivered costPerLead=0.35
[backfill-coin-debit-on-status] summary {
  dryRun: true,
  cityRefunded: 35,
  cityStamped: 0,
  cityReopened: 0,
  listRefunded: 0,
  listStamped: 0,
  orphansLogged: 0,
  skipped: 0
}
```

Script subiu e conectou ao DB sem mutação (`--dry-run`). Em staging/prod, repetir dry-run e conferir `cityRefunded` / orphans antes do run real.

---

## Checklist E2E (webhook sintético)

Pré-requisitos: notifly + gym-ctrl no ar; tenant com `costPerLead` / lista com `costPerSend` > 0; saldo S conhecido.

Webhook sintético (sem Meta):

```http
POST {{notiflyBaseUrl}}/response-leads
Content-Type: application/json
```

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "WABA_ID",
    "changes": [{
      "field": "messages",
      "value": {
        "metadata": {
          "display_phone_number": "15550001111",
          "phone_number_id": "PHONE_NUMBER_ID"
        },
        "statuses": [{
          "id": "WAMID_DO_ENVIO",
          "status": "delivered",
          "timestamp": "1710000000",
          "recipient_id": "5511999999999"
        }]
      }
    }]
  }]
}
```

`id` = `TenantLead.messageId` (cidade) ou `TenantListSend.wamid` (lista).  
`status`: `sent` | `delivered` | `read` | `failed`.

### Lista

| # | Passo | Esperado | ✓/✗ |
|---|-------|----------|-----|
| L1 | Saldo S; Graph OK 1 lead | saldo ainda S; `coinDebitedAt` null | ☐ |
| L2 | Webhook `delivered` (gatilho default) | saldo S−cost; `coinDebitedAt` set | ☐ |
| L3 | Novo envio; webhook `failed` | sem débito líquido; unlock lead | ☐ |
| L4 | PATCH platform `coinDebitOnStatus=sent`; Graph+`sent` | debita; depois `failed` estorna | ☐ |

### Cidade

| # | Passo | Esperado | ✓/✗ |
|---|-------|----------|-----|
| C1 | Graph OK | sem débito; phone excluído do próximo ciclo | ☐ |
| C2 | Webhook `failed` | estorno se havia débito; `contacted=false`; phone selecionável de novo | ☐ |
| C3 | Webhook `delivered` | debita 1× | ☐ |

### Reserva

| # | Passo | Esperado | ✓/✗ |
|---|-------|----------|-----|
| R1 | Dois Graph OK sem webhook | affordable reduz 2 × cost | ☐ |

### Backfill

| # | Passo | Esperado | ✓/✗ |
|---|-------|----------|-----|
| B1 | Dry-run em staging | counts impressos; DB intacto | ☐ |
| B2 | Run real + segundo run | segundo run: refunds/stamps = 0 extras | ☐ |
| B3 | Failed cidade pós-backfill | `contacted=false` | ☐ |

---

## Produção

1. Confirmar release com tasks 2+3 deployadas.  
2. `npx ts-node scripts/backfill-coin-debit-on-status.ts --dry-run` → revisar orphans e counts.  
3. Rodar sem `--dry-run` (janela de baixo tráfego se possível).  
4. Re-run dry-run ou real: summary com `cityRefunded=0`, `listRefunded=0`, stamps só se ainda houver legado sem stamp.  
5. Executar checklist L/C/R acima em staging antes de confiar no prod.
