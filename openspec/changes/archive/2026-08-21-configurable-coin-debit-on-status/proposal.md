## Why

A Meta só cobra template quando a mensagem chega a `delivered`, mas a plataforma debita coins no Graph 200. Clientes pagam undeliverable (`failed`) e envios que nunca entregam — e, em cidade, o telefone ainda fica queimado. Precisamos alinhar cobrança ao status de entrega, com gatilho configurável por tenant (default `delivered`).

## What Changes

- **Parar de debitar** coins no aceite Graph (cidade e lista); debitar quando o webhook atingir o status configurado do tenant (`sent` | `delivered` | `read`).
- **Default** do gatilho: `delivered` (alinha Meta). Super Admin pode alterar por tenant.
- Em `failed`: **não debitar**; se já houver débito (ex. gatilho `sent` depois `failed`, ou legado), **estornar** uma vez; lista continua com unlock; **cidade também reabre o telefone** para novo outreach.
- Marcar cobrança/estorno de forma **idempotente** por envio (`wamid` / send), para webhooks repetidos e retries de lista.
- Cron passa a considerar **saldo reservado** por envios aceitos ainda não cobrados e não falhos (evita overspend enquanto o débito atrasa até o webhook).
- **Job/migração retroativa**: estornar débitos de envios já `failed` (e, quando o gatilho do tenant for `delivered`/`read`, também de `sent`/pendente já debitados no modelo antigo); reabrir telefones de cidade elegíveis.
- APIs de config de outreach/plataforma expõem o novo campo; Postman/Swagger/FRONT-INTEGRATION atualizados.

## Capabilities

### New Capabilities

- `coin-debit-on-status`: regras de quando debitar/estornar coins a partir de status Meta, reserva de saldo, idempotência por envio e backfill retroativo.

### Modified Capabilities

- `tenant-outreach-config`: persiste e valida o gatilho de débito por tenant; preço continua em `costPerLead`.
- `cloud-outreach-runtime`: não debita no Graph 200; `failed` reabre telefone no pool do tenant; seleção de exclusão de phones respeita unlock.
- `tenant-list-campaigns`: não debita no Graph 200; débito no status configurado; unlock + estorno em `failed`.
- `whatsapp-send-status`: ao persistir status, dispara cobrança/estorno conforme config do tenant (cidade e lista).

## Impact

- **Prisma:** campo de gatilho no tenant (ou config); flags/timestamps de cobrança e estorno em `TenantLead` / `TenantListSend`; possível vínculo em `CoinTransaction`.
- **notifly:** `leads.service` / `list-campaigns.service` (remover débito no send; reserva); `webhook-persistence.service` (débito/estorno + reopen cidade); job de backfill.
- **gym-ctrl:** DTOs/controllers de outreach (e leitura de home/ops se expuser o campo); Swagger/Postman.
- **Front:** campo de config Super Admin; sem mudança de UX de inbox além do comportamento de saldo.
- **Fora:** cashback de reply, notify templates, Baileys, captura, test-send de catálogo.
