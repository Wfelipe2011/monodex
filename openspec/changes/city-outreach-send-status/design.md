## Context

Outreach de cidade (`contactLeads` no notifly) cria um `TenantLead` por POST Graph e grava só `messageId` (wamid). O webhook `handleStatus` sempre insere `WhatsappSendStatus`, mas só atualiza `lastStatus` quando encontra `TenantListSend`. Status de cidade ficam órfãos (`listSendId` nulo).

Campanhas de lista já têm recurso próprio: `TenantListSend` + `GET /tenant/:tenantId/lead-lists/:listId/sends`. Cidade só expõe counts de funil (`GET .../leads/stats`). Captura/Baileys também cria `TenantLead` **sem** `messageId` — esses rows não são envio Cloud API.

Front não vive neste repo; contrato é Swagger + Postman + polling (sem WebSocket).

## Goals / Non-Goals

**Goals:**

- Correlacionar statuses Meta ao `TenantLead` de cidade pelo `wamid`.
- Snapshot do nome do template no send (`contactLeads`).
- Listagem para o front: status, nome e telefone do lead, nome do template, `latestError` se `failed`.
- Manter lista e cidade em tabelas, lookups e URLs distintos.

**Non-Goals:**

- Reutilizar `TenantListSend` ou o path `.../lead-lists/:listId/sends`.
- Notify ao `Tenant.phone` após “Tenho Interesse!” (não guarda wamid hoje).
- Realtime / WebSocket / push desses statuses.
- Unlock ou reenvio automático quando cidade falha (regra “um telefone por tenant” permanece).
- Inbox unificado de cidade; Baileys; telas neste repo.
- Enriquecer sends de lista com `templateName` (fora deste recorte).

## Decisions

### D1 — `TenantLead` é o send de cidade; não criar `TenantOutreachSend`

**Escolha:** Estender `TenantLead` com `lastStatus` (`WhatsappDeliveryStatus?`) e `templateName` (`String?`). `messageId` continua sendo o wamid. `createdAt` do row Cloud API é o `sentAt` da API.

**Por quê:** O runtime já é 1:1 Graph 200 → um `TenantLead`. Tabela irmã duplicaria o que a lista já fez, misturando mentalmente dois produtos.

**Alternativa rejeitada:** `TenantOutreachSend` paralelo a `TenantListSend`. Melhor se houver N envios por lead ou notify; aqui o produto ainda é um contato por telefone por tenant.

### D2 — Envelope compartilhado, vínculo separado

**Escolha:** Continuar inserindo todo `statuses` em `WhatsappSendStatus`. Adicionar `tenantLeadId` opcional (espelho de `listSendId`). `handleStatus`:

1. Lookup `TenantListSend` por `wamid`.
2. Lookup `TenantLead` por `messageId === wamid` (não é lista).
3. Insert do evento com `listSendId` e/ou `tenantLeadId`.
4. Se lista: atualizar `TenantListSend.lastStatus` + unlock em `failed` (igual hoje).
5. Se cidade: atualizar só `TenantLead.lastStatus`. **Não** mexer em lock de lista.

Um `wamid` de cidade não cria `TenantListSend`. Um de lista não escreve `TenantLead.lastStatus`.

**Por quê:** O usuário pediu isolamento de produto, não dois envelopes. O evento Meta é o mesmo tipo.

**Alternativa rejeitada:** Tabela `CityOutreachSendStatus`. Duplica o modelo que já existe.

### D3 — Snapshot de `templateName`, não FK viva

**Escolha:** No `tenantLead.create` de `contactLeads`, gravar `outreachTemplate.name` (string). Listagem devolve esse campo; se null (histórico / Baileys), o front mostra vazio.

**Por quê:** Admin pode trocar `outreachTemplateId` depois. Join no catálogo mentiria.

**Alternativa rejeitada:** Só `templateId`. O catálogo pode ser re-syncado/renomeado; o nome na hora do disparo é o que o operador viu.

Não snapshotar language nesta change (o pedido é o nome).

### D4 — API própria, dois prefixos, contrato irmão da lista

**Escolha:**

| Path | Quem |
|------|------|
| `GET /tenant/:tenantId/outreach/sends` | `ADMIN` + `SUPER_ADMIN` GET, `TenantScopeGuard` + `TenantActiveGuard` |
| `GET /platform/tenants/:tenantId/outreach/sends` | `SUPER_ADMIN` |

Query: `status=failed` opcional. Até 100, `createdAt` desc. Só rows com `messageId` não nulo (exclui TenantLead da captura).

Payload:

```json
{
  "id": 12,
  "wamid": "wamid.xxx",
  "sentAt": "2026-08-18T20:05:00.000Z",
  "lastStatus": "delivered",
  "templateName": "hello_city",
  "lead": { "id": 90, "name": "Academia X", "phone": "11999999999" },
  "latestError": null
}
```

`latestError` só quando `lastStatus=failed`, mesma agregação de `WhatsappSendStatus` usada nas listas.

404 se o tenant não existir. Sem WebSocket.

**Por quê:** Stats de cidade já existem nos dois prefixos; sends de lista só no `/tenant`. Super Admin opera cidade em Platform — espelhar stats.

**Alternativa rejeitada:** Um único GET que mistura lista + cidade. Produtos separados.

### D5 — Unique em `messageId` onde preenchido

**Escolha:** Unique em `TenantLead.messageId`. Postgres permite vários `NULL` (captura). Webhook passa a poder `findUnique`.

**Por quê:** Correlação 1:1 com o envelope. `findFirst` é opaco se houver lixo.

Migration falha se já existirem duplicatas não-nulas — risco baixo (wamid Meta é único). Se aparecer, a migration aborta e se investiga; não silenciar.

### D6 — Backfill de `lastStatus` / `tenantLeadId`; `templateName` histórico fica null

**Escolha:** Na migration (SQL):

- Ligar `whatsapp_send_statuses.list_send_id` IS NULL **e** `wamid` = `tenant_leads.message_id` → set `tenant_lead_id`.
- Para cada `TenantLead` com `message_id`, setar `last_status` a partir do evento de maior `meta_timestamp`.

Não inventar `templateName` a partir da config atual.

**Por quê:** Status órfãos já existem. Nome do template antigo é desconhecido.

## Risks / Trade-offs

- **[Risco]** `failed` de cidade não reabre o telefone para novo outreach → Mitigação: documentar; reenvio é change futura, não misturar com lock de lista.
- **[Risco]** Unique em `message_id` quebra se houver duplicata → Mitigação: `prisma migrate` em staging primeiro; se falhar, dedup manual.
- **[Risco]** Front confundir os dois GETs de sends → Mitigação: paths e DTOs distintos; FRONT-INTEGRATION curto.
- **[Trade-off]** Snapshot é string solta (sem FK) → listagem sobrevive a troca de template; não dá para navegar ao catálogo só com o nome (aceitável).
- **[Trade-off]** `lastStatus` null até o primeiro webhook → igual listas; Graph 200 não é `sent`.

## Migration Plan

1. Schema Prisma + migration SQL (colunas, unique, backfill de vínculo/`last_status`).
2. notifly: snapshot no create; `handleStatus` com lookup de cidade.
3. gym-ctrl: service + dois controllers GET.
4. Testes unitários (webhook + listagem); Postman; Swagger.
5. Rollback: drop das colunas novas; `WhatsappSendStatus` sem `tenantLeadId` volta ao comportamento atual (órfãos). Dados de lista intactos.

## Open Questions

Nenhum bloqueante. Notify de cidade e reenvio após `failed` ficam para outra change se o produto pedir.
