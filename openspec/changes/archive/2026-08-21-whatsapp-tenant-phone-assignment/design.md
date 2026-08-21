## Context

Envio oficial é Cloud API (`apps/notifly` + inbox em `apps/gym-ctrl`). `WhatsappAccount` já tem `phoneNumberId`, `wabaId`, `tokenEnvKey` e `tenantId` opcional, mas:

- A API força `tenantId: null` e o produto recusa conta “comercial”.
- `PlatformWhatsappService.resolveCredentials()` / `PlatformWhatsappAdminService.resolveCredentials()` fazem `findFirst` de conta plataforma enabled — um único FROM para todos os tenants, e opaco se existirem duas rows.
- Templates são unique `(whatsappAccountId, name, language)` e o sync upserta na conta resolvida. Vários números no mesmo WABA, se cada um virar “a” conta do sync, duplicam o catálogo.
- `TenantOutreachConfig` não aponta para número. Split de papéis atual: preço = Super Admin; knobs/templates = Admin. Amarração de número é decisão de plataforma (Super Admin).
- Webhook já recebe `value.metadata.phone_number_id` e ignora (`_metadata`). Correlação inbound é só `context.id` → `TenantListSend.wamid` / `TenantLead.messageId`.
- `Tenant.phone` é o WhatsApp do **cliente** (welcome `wa.me` + notify TO), não o FROM.

Um WABA Meta comporta vários números (teto típico 2→20 no Business Portfolio). Token continua um (`WHATSAPP_TOKEN`). Templates são do WABA, não do número.

## Goals / Non-Goals

**Goals:**

- Inventário de N números plataforma no mesmo `wabaId`.
- Um default explícito, compartilhado por tenants sem amarração.
- Super Admin atrela um número não-default a no máximo um tenant.
- Todo POST Graph de mensagem de um tenant usa o `phoneNumberId` resolvido (dedicado ou default).
- Sync de templates uma vez, na conta default.
- Webhook consegue atribuir inbound sem `context` quando o número é dedicado.

**Non-Goals:**

- WABA por tenant, Embedded Signup, token no banco ou `tokenEnvKey` distinto por cliente.
- Usar `WhatsappAccount.tenantId` como amarração (coluna permanece null).
- Admin do tenant escolher o número.
- Baileys / `apps/captura` outbound.
- Frontend/SPA (contrato no Postman + FRONT-INTEGRATION se útil).
- Persistir `whatsappAccountId` em cada `WhatsappConversationMessage` (reply usa a amarração **atual**).
- Subir o teto Meta de números; isso é operação no Business Manager.

## Decisions

### D1 — Número = row `WhatsappAccount`; WABA é atributo compartilhado

**Escolha:** Continuar 1 row por `phoneNumberId`. Todas as rows desta change **devem** ter o mesmo `wabaId` (o da conta default, ou o da primeira conta se ainda não houver default). `tenantId` permanece `null`. Unique em `phoneNumberId`.

**Por quê:** É o modelo que já existe. O WABA não precisa de tabela nova enquanto só há um.

**Alternativa rejeitada:** Tabela `WhatsappWaba` + filhos. Certa se vier BYO WABA; cedo agora.

**Alternativa rejeitada:** Preencher `WhatsappAccount.tenantId`. Mistura inventário com uso, quebra o CRUD `/platform/whatsapp-accounts` (hoje lista só `tenantId` null) e impede default compartilhado (vários tenants no mesmo número).

### D2 — Default explícito (`isDefault`), não `findFirst`

**Escolha:** Boolean `isDefault` em `WhatsappAccount`. Exatamente uma row com `isDefault=true` (índice unique parcial no SQL). Resolver sem amarração usa essa row, `enabled=true`, `provider=CLOUD_API`, `tenantId=null`.

Regras:

- Primeira conta criada vira default se ainda não houver.
- `PATCH { isDefault: true }` promove e desmarca a anterior na mesma transação.
- Não dá para `enabled=false` na default.
- Não dá para promover a default uma conta que está amarrada a um tenant (precisa desamarrar antes).

**Por quê:** Com N números, `findFirst` é bug.

**Alternativa rejeitada:** Singleton `PlatformSettings.defaultWhatsappAccountId`. Mais uma tabela para um booleano.

### D3 — Amarração em `TenantOutreachConfig.whatsappAccountId`, platform-owned

**Escolha:** FK nullable para `WhatsappAccount`. `null` = usar default. Preenchido = número dedicado.

- Unique na coluna (Postgres permite vários `null`) → exclusividade.
- Super Admin escreve em `PATCH /platform/tenants/:tenantId/outreach-config` junto com preço (`PatchPlatformOutreachConfigDto`).
- Admin em `/tenant/:tenantId/outreach-config`: campo no body → 403 (mesmo padrão de `costPerLead`). GET devolve `whatsappAccountId` e um objeto resolvido só leitura (`id`, `phoneNumberId`, `displayPhone`, `isDefault`).
- PUT bootstrap Super Admin **pode** incluir `whatsappAccountId` (campo de plataforma, sempre editável — não depende da janela de 30 min).
- PUT Admin **não** aceita o campo; omitido = `null` (default).
- Alvo da FK: conta enabled, não-default, não amarrada a outro tenant. Id da conta default → 400 (use `null`).
- `null` no PATCH desamarra.

**Por quê:** Default compartilhado é ausência de FK, não “todo mundo aponta para a default”. Exclusivo no banco impede dois clientes no mesmo FROM dedicado. Papel = Super Admin, alinhado ao pedido.

**Alternativa rejeitada:** Join table N:N. O produto é 1:1 dedicado + pool default.

### D4 — Resolver por tenant nos dois apps, sem extrair lib nesta change

Algoritmo único (copiado em `apps/notifly/src/platform-whatsapp.service.ts` e `apps/gym-ctrl/src/modules/admin/platform-whatsapp-admin.service.ts`):

```
resolveCredentials(tenantId?: number):
  if tenantId:
    config = TenantOutreachConfig by tenantId
    if config?.whatsappAccountId:
      account = WhatsappAccount by id (enabled, CLOUD_API)
      if missing/disabled → erro explícito (não cair no default em silêncio)
      return creds(account)
  account = WhatsappAccount where isDefault && enabled && tenantId null && CLOUD_API
  if missing → erro
  token = process.env[account.tokenEnvKey]
  messagesUrl = https://graph.facebook.com/v23.0/{phoneNumberId}/messages
```

Chamadas com tenant: `leads.service` (contact + notify), `list-campaigns.service`, `list-campaign-reply.service`, `list-conversations.service` (reply inbox).

Chamadas **sem** tenant (default): sync de templates, test-send sem `whatsappAccountId` no body.

Test-send Super Admin: body opcional `whatsappAccountId`; se omitido, default.

**Alternativa rejeitada:** extrair para `libs/` nesta change — os dois serviços já estão duplicados; unificar é refactor à parte.

### D5 — Catálogo fica na conta default

**Escolha:** `GET /{wabaId}/message_templates` usa `wabaId` + token da default. Upsert `whatsappAccountId = default.id`. Grants, outreach FKs e campanhas continuam apontando para essas rows.

Números extras **não** ganham cópia do catálogo. Templates APPROVED do WABA valem para qualquer `phoneNumberId` da mesma WABA.

**Por quê:** Unique atual é por conta; sync por número duplicaria `test_gladson` N vezes e quebraria grants.

**Implicação:** se a default mudar de row, o catálogo antigo fica na row anterior. Promoção de default **não** move templates nesta change. Super Admin não deve promover outra conta a default como operação casual; se precisar, sync de novo na nova default (follow-up). Documentar no risco.

### D6 — Webhook: `context` manda; `phone_number_id` desempata dedicado

Ordem em `WebhookPersistenceService.resolveCorrelation`:

1. `context.id` → `TenantListSend` / `TenantLead` (igual hoje; vence conflito).
2. Senão, `metadata.phone_number_id` → `WhatsappAccount.phoneNumberId`. Se a conta **não** é default **e** existe `TenantOutreachConfig.whatsappAccountId = essa conta`, `tenantId` = esse tenant (`listLeadId` null se não houver lead de lista).
3. Senão `unknown` (número default compartilhado sem context, ou número não cadastrado). Persistência continua exigindo `tenantId`.

Reply do inbox e notify de botão usam `resolveCredentials(tenantId)` — o FROM de volta é o da amarração atual, não o número histórico da mensagem.

### D7 — Mesmo token / mesmo webhook Meta

Novos números no WhatsApp Manager, mesmo App, mesmo `WHATSAPP_TOKEN`, mesmo callback. Código não cadastra número na Meta.

`displayPhone` continua opcional (rótulo humano). Qualidade/ban é por número na Meta; isolamento de conversa no produto é a exclusividade da FK.

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| Duas contas enabled sem `isDefault` após migrate | Backfill: a row enabled mais antiga (`id` asc) vira default; se já houver mais de uma, ainda assim só uma default |
| Super Admin amarra o default e “rouba” o compartilhado | 400 se o alvo é `isDefault` |
| Conta dedicada desabilitada com tenant amarrado | Resolver falha alto (log + throw); não silencia no default (evita vazar conversa para o número compartilhado) |
| Promover outra default deixa catálogo na row antiga | Não mover templates; sync na default atual; documentar |
| Inbound no default sem `context` não tem tenant | Comportamento atual; não chutar tenant |
| Reatribuir número no meio da janela 24h | Reply sai do número **atual**; janela Meta é por número — risco operacional, não silenciado no código |
| Teto Meta ~20 números | Fora do código; Super Admin opera no Business Manager |
| Duplicar lógica do resolver em dois apps | Testes/contratos iguais; extração de lib = change futura |

## Migration Plan

1. Prisma: `isDefault Boolean @default(false)` em `WhatsappAccount`; `phoneNumberId` unique; `TenantOutreachConfig.whatsappAccountId Int?` + relation + unique.
2. SQL extra na migration: `CREATE UNIQUE INDEX whatsapp_accounts_one_default ON whatsapp_accounts (is_default) WHERE is_default = true;`
3. Backfill: `UPDATE ... SET is_default = true` na menor `id` com `tenant_id IS NULL AND enabled AND provider = 'CLOUD_API'` se nenhuma default existir.
4. Seed: `upsertPlatformAccount` seta `isDefault: true` na conta `1292251013966333` (não desmarca outras à mão além do índice).
5. Deploy gym-ctrl + notifly juntos (resolver novo). Rollback: revert deploy; coluna FK pode ficar null (comportamento = todos no default).

## Open Questions

- Nenhum bloqueante. Follow-up consciente: mover catálogo ao trocar a default; persistir `phoneNumberId` no inbox para auditoria.
