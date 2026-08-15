## Why

O template de outreach `test_gladson` passou a ter variável positional `{{1}}` no body (“quem entra em contato”). O Notifly hoje envia só o header image; a Meta rejeita o template sem o parâmetro de body. Cada tenant precisa de um texto próprio, persistido na config — não dá para hardcodar o exemplo do Gladson.

## What Changes

- Persistir `outreachContactText` em `TenantOutreachConfig`: texto livre, fixo (sem rotação), obrigatório para habilitar outreach, com limite de caracteres.
- Super-admin lê e grava o campo em GET/PUT/PATCH de outreach config.
- O runtime Cloud API preenche o componente BODY positional `{{1}}` com esse texto em todo envio de outreach.
- **BREAKING** (contrato admin): PUT passa a exigir `outreachContactText`; `enabled=true` é rejeitado se o texto estiver vazio após trim. Rows existentes recebem string vazia na migration e precisam de backfill operacional antes do próximo disparo com o template novo.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `tenant-outreach-config`: persistir e validar `outreachContactText` (obrigatório, limite, sem newline).
- `cloud-outreach-runtime`: enviar parâmetro positional de body no template de outreach a partir da config; não chamar a Meta se o texto estiver ausente.
- `admin-platform-config`: SUPER_ADMIN gerencia `outreachContactText` no PUT/PATCH e o enable exige o campo preenchido.

## Impact

- **Schema/DB:** coluna `outreach_contact_text` em `tenant_outreach_configs`; migration com default `''` nas rows atuais.
- **Apps:** `apps/gym-ctrl` (DTOs, `OutreachConfigService.assertEnableAllowed`); `apps/notifly` (`LeadsService.contactLeads`).
- **Operação:** seed e Postman; tenants já enabled precisam de um PATCH com o texto antes de o template aprovado funcionar.
- **Não altera:** scrape, mix premium, coins, notify-tenant (named params), header image / env fallback, welcome, WhatsApp account.
