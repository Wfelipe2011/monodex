## Why

Todos os tenants enviam pelo mesmo `phoneNumberId` da plataforma: o resolver ignora o tenant e o admin recusa contas comerciais. Clientes que precisam de um número próprio (marca, qualidade, conversa isolada) não têm como ser atendidos, e cadastrar um segundo número hoje deixa o `findFirst` opaco. Há um único WABA com capacidade de vários números; o Super Admin precisa escolher o FROM por tenant e manter um número default compartilhado para quem entra sem número dedicado.

## What Changes

- Permitir **vários** `WhatsappAccount` da plataforma (`tenantId` continua null) no **mesmo** `wabaId`, cada um com um `phoneNumberId` distinto.
- Marcar **exatamente um** número como **default** (`isDefault`). Tenants sem amarração enviam por ele (compartilhado).
- Super Admin **atrelar** um número não-default a um tenant via `TenantOutreachConfig.whatsappAccountId` (campo de plataforma, como preço). `null` = default. Admin do tenant **não** escreve esse campo; GET pode devolver o número resolvido só leitura.
- Número dedicado é **exclusivo** (no máximo um tenant). O default não pode ser o alvo da amarração.
- Runtime (outreach, notify, campanhas de lista, reply do inbox) resolve credenciais **por tenant**: dedicado se houver, senão default.
- Webhook passa a usar `metadata.phone_number_id`: inbound sem `context` num número dedicado cai naquele tenant; no default compartilhado a correlação continua pelo `wamid`.
- Sync de templates Graph **uma vez por WABA**, na conta default — sem duplicar catálogo por número.
- **Não** inclui BYO WABA, Embedded Signup, token por tenant, Baileys, frontend, nem mudar `Tenant.phone` (WhatsApp do cliente para aviso/welcome).

## Capabilities

### New Capabilities

- `whatsapp-tenant-phone-assignment`: inventário de números no WABA da plataforma, um default compartilhado, amarração exclusiva Super-Admin → tenant, e resolução de FROM por tenant com fallback.

### Modified Capabilities

- `platform-whatsapp-cloud`: deixa de ser “um único sender para todos”; envio oficial usa o número resolvido do tenant (default ou dedicado), mesmo WABA e token via env.
- `admin-platform-config`: CRUD de várias contas plataforma; `isDefault`; `wabaId` único da frota; PATCH de `whatsappAccountId` no outreach config; `tenantId` em conta continua recusado.
- `tenant-outreach-config`: `whatsappAccountId` opcional, **platform-owned**; `null` = default; Admin não persiste o campo.
- `cloud-outreach-runtime`: `contactLeads` / notify usam o `phoneNumberId` resolvido do tenant.
- `tenant-list-campaigns`: envio de template e notify ao `Tenant.phone` usam o número resolvido do tenant.
- `whatsapp-conversation-inbox`: reply de texto usa o número resolvido do tenant; persistência inbound considera `phone_number_id`.
- `whatsapp-template-catalog`: sync lista Graph pelo `wabaId` da conta **default** e upserta catálogo nessa conta.

## Impact

- **Schema:** `WhatsappAccount.isDefault` + unique de `phoneNumberId` + índice de um default; `TenantOutreachConfig.whatsappAccountId` nullable FK exclusivo quando preenchido. `WhatsappAccount.tenantId` permanece null (não é o mecanismo de amarração).
- **gym-ctrl:** `/platform/whatsapp-accounts` (vários números, `isDefault`); `PATCH /platform/tenants/:tenantId/outreach-config` aceita `whatsappAccountId`; DTOs/403 no `/tenant` se o Admin tentar o campo; resolver de credenciais por tenant no inbox e no teste de template.
- **notifly:** `PlatformWhatsappService.resolveCredentials(tenantId?)`; outreach, campanhas, notify, webhook.
- **Seed / Postman / swagger:** conta existente vira default; requests de segundo número e de amarração.
- **Fora:** apps/captura, Baileys, Meta token no banco, múltiplos WABAs, UI.
