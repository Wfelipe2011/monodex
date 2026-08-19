## Why

O webhook da Meta já grava eventos de entrega, mas o outreach de cidade só guarda o `wamid` em `TenantLead.messageId`. O front não tem como listar status, destinatário ou template daqueles disparos. Campanhas de lista já têm isso — e precisam continuar isoladas, porque o funil de cidade e o de lista são produtos separados.

## What Changes

- Persistir status de entrega (`sent` / `delivered` / `read` / `failed`) no outreach de cidade, correlacionando o webhook a `TenantLead` pelo `wamid` (`messageId`).
- Snapshot do **nome do template** no momento do POST Graph — não ler a config ao vivo na listagem.
- Expor listagem de envios de cidade para o front (polling, sem realtime): status, nome e telefone do lead, nome do template, erro se `failed`.
- **Não** reutilizar `TenantListSend` nem o endpoint de sends de lista. Envelope `WhatsappSendStatus` pode ser compartilhado (já é genérico por `wamid`); o vínculo e a API de cidade ficam à parte.
- Notify ao `Tenant.phone` após “Tenho Interesse!” fica **fora** deste recorte.

## Capabilities

### New Capabilities

- `city-outreach-sends`: snapshot de template e `lastStatus` no envio de cidade (`TenantLead`); API de listagem para Admin e Super Admin, separada dos sends de lista.

### Modified Capabilities

- `whatsapp-send-status`: eventos append-only também se ligam a `TenantLead` quando o `wamid` for de outreach de cidade; listagem e unlock de lista permanecem só em `TenantListSend`.
- `cloud-outreach-runtime`: após Graph 200, além de `messageId`, gravar o nome do template usado; `lastStatus` começa nulo até o primeiro callback da Meta.

## Impact

- **Prisma:** campos em `TenantLead` (`lastStatus`, `templateName`); `WhatsappSendStatus.tenantLeadId` opcional; unique/`index` em `messageId` para correlação.
- **notifly:** `contactLeads` grava snapshot; `handleStatus` atualiza `TenantLead` quando o `wamid` não for (só) de lista.
- **gym-ctrl:** `GET` de envios de cidade em `/tenant` e `/platform`, espelhando o contrato de sends de lista mas sem misturar recursos.
- **Front:** polling; sem WebSocket. Postman + Swagger. Sem telas neste repo.
- **Fora:** campanhas de lista, inbox, notify de cidade, Baileys, captura.
