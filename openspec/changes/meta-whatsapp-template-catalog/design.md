## Context

Notifly monta payloads Graph à mão: outreach usa `config.outreachTemplateName` + header IMAGE (`headerImageUrl` ou `WHATSAPP_OUTREACH_HEADER_IMAGE_URL`) + um body positional (`outreachContactText`); notify usa `notifyTenantTemplateName` + named params (`customer_lead` de env, `customer_name`, `customer_phone`) + botão URL. `WhatsappAccount` da plataforma tem `phoneNumberId` e `tokenEnvKey`, mas **não** o WABA ID exigido por `GET /{waba-id}/message_templates`. Captura scrape está em `@Cron('0 6 * * *', { timeZone: 'America/Sao_Paulo' })`. Frontend é app externo; este repo só API.

## Goals / Non-Goals

**Goals:**

- Espelhar templates da WABA compartilhada no banco, com slots parseados para o front.
- Amarração por tenant: dois FKs (outreach + notify) + mapa de bindings.
- Builder genérico de `components` no cron e no webhook.
- Teste SUPER_ADMIN para qualquer destino, sem funil/coin.
- Sync on-demand + cron configurável; scrape 06:00 também vira schedule persistido.
- `wabaId` no `WhatsappAccount` (plataforma agora; tenant depois reusa o campo).

**Non-Goals:**

- Telas neste monorepo.
- Contas WhatsApp comerciais por tenant (MVP continua `tenantId` null).
- Criar/editar/aprovar templates na Meta.
- Motor de binding genérico (paths Prisma livres).
- Debitar coin ou criar `TenantLead` no teste.
- Webhook de demo (clique em teste não notifica vendedor).

## Decisions

### D1 — `wabaId` em `WhatsappAccount`

**Escolha:** coluna `wabaId` (`String`, map `waba_id`). Create/PATCH admin exigem string não vazia. Token continua só via `tokenEnvKey`.

**Por quê:** Listagem Graph é por WABA, não por `phoneNumberId`. Campo na conta (não env) já serve se no futuro `tenantId` deixar de ser null.

**Alternativa rejeitada:** só `WHATSAPP_WABA_ID` no env — mais rápido, mas não viaja com a conta.

### D2 — Catálogo `WhatsappMessageTemplate`

**Escolha:** unique `(whatsappAccountId, name, language)`. Guardar `metaId`, `status`, `category`, `parameterFormat`, `components` (JSON cru Meta), `slots` (JSON parseado), `lastSyncedAt`. Sync **upsert**; templates que sumiram da Graph ou não `APPROVED` ficam com o status Meta (envio e `enabled=true` só aceitam `APPROVED`).

**Slots** (contrato estável para o front):

```json
[
  { "key": "header.image", "component": "header", "paramType": "image" },
  { "key": "body.1", "component": "body", "paramType": "text", "format": "positional", "index": 1 },
  { "key": "body.customer_name", "component": "body", "paramType": "text", "format": "named", "parameterName": "customer_name" },
  { "key": "button.0.url", "component": "button", "paramType": "text", "index": 0, "subType": "url" }
]
```

**Por quê:** o front não reimplementa parser de `components`. Teste e config usam as mesmas `key`s.

### D3 — Bindings na outreach config (breaking)

**Escolha:** remover `outreachTemplateName`, `notifyTenantTemplateName`, `outreachContactText`, `headerImageUrl`. Adicionar `outreachTemplateId`, `notifyTemplateId` (FK para catálogo) e `slotBindings` JSON:

```json
{
  "outreach": {
    "header.image": { "type": "header_image", "value": "https://cdn.example/header.png" },
    "body.1": { "type": "literal", "value": "Gladson Teixeira (contador em Pindamonhagaba)" }
  },
  "notify": {
    "body.customer_lead": { "type": "literal", "value": "interessado em contratar Certificados Digitais" },
    "body.customer_name": { "type": "lead.name" },
    "body.customer_phone": { "type": "lead.phone" },
    "button.0.url": { "type": "lead.phone" }
  }
}
```

`header_image` usa `value` https (substitui o campo flat + env). Sem fallback `WHATSAPP_OUTREACH_HEADER_IMAGE_URL` nem `WHATSAPP_NOTIFY_CUSTOMER_LEAD` no runtime.

**Enum de `type` (fechado):** `literal`, `header_image`, `lead.name`, `lead.phone`, `lead.city`, `lead.category`, `lead.rating`, `tenant.phone`, `now.date`, `now.datetime`.

**Formatação:** `now.*` e `lead.rating` em `pt-BR` / `America/Sao_Paulo` (`15/08/2026`, `15/08/2026 22:23`, `4,5`). `lead.phone` dígitos com prefixo `55` se faltar. `lead.city` = `City.name`. `lead.category` = `Lead.category`. Campos de lead ausentes → texto `—` (não pula o envio).

**Enable:** tenant ativo + phone; ambos FKs; templates `APPROVED` da conta plataforma; todo slot required do catálogo tem binding nas chaves `outreach` / `notify`. Literal/`header_image` exigem `value` não vazio (header URL https). `literal` de texto: trim, sem `\n`/`\r`/`\t`; máx. 80 só se o slot for body text (manter disciplina do contact text).

**Alternativa rejeitada:** dois endpoints de teste + preview da config — um POST com `variables` + `leadId` opcional cobre QA e demo.

### D4 — Um endpoint de teste

`POST /admin/whatsapp-templates/:id/test` (SUPER_ADMIN):

```json
{ "to": "11999999999", "variables": { "body.1": "…" }, "leadId": 123 }
```

- `to`: dígitos; normalizar `55`.
- Resolve slots do catálogo: `variables` sobrescreve; `leadId` alimenta `lead.*`; `now.*` sempre do relógio; slots ainda vazios → 400.
- POST Graph `type: template` com `name`/`language` da row.
- **Não** cria `TenantLead`, **não** mexe em coin.
- Template deve estar `APPROVED`.

### D5 — Sync Graph

- `GET https://graph.facebook.com/v23.0/{wabaId}/message_templates` com o token da conta plataforma (mesmo `GRAPH_API_VERSION` de `platform-whatsapp.service.ts`).
- `POST /admin/whatsapp-templates/sync` dispara o mesmo job.
- `GET /admin/whatsapp-templates` lista o catálogo (query `status`, `name`); resposta inclui `slots` + `components`.
- Cron lê `PlatformJobSchedule` `WHATSAPP_TEMPLATE_SYNC`. Default: `0 5 * * *`, `America/Sao_Paulo`, `enabled: true` (antes do scrape 06:00).

Job no **notifly** (já tem HttpModule + credenciais). Admin gym-ctrl também chama o serviço de sync (HttpModule no AdminModule) para o POST manual — extrair fetch/upsert para `@core/shared` + um serviço Prisma em cada app **ou** um helper puro + Prisma no caller. Preferência: funções puras em `libs/shared` (`parseTemplateSlots`, `buildTemplateComponents`, `resolveBindingValue`) e cada app faz HTTP/Prisma.

### D6 — `PlatformJobSchedule`

```
enum PlatformJobKey { WHATSAPP_TEMPLATE_SYNC, SCRAPE }

model PlatformJobSchedule {
  jobKey         PlatformJobKey @unique
  cronExpression String         // 5 campos, validar no DTO
  timeZone       String         @default("America/Sao_Paulo")
  enabled        Boolean        @default(true)
}
```

Admin: `GET/PUT /admin/platform-job-schedules/:jobKey` SUPER_ADMIN.

**Runtime:** não usar `@Cron` estático. `SchedulerRegistry` + reconstruir o job quando o PUT mudar **e** no `onModuleInit` (captura lê `SCRAPE`, notifly lê `WHATSAPP_TEMPLATE_SYNC`). Se row ausente, fallback aos defaults atuais (`0 6 * * *` scrape, `0 5 * * *` sync). Se `enabled=false`, não registra cron (POST sync manual ainda funciona).

**Por quê:** um model cobre os dois crons que o produto queria deixar de ter hora no código.

### D7 — Shared builder

Notifly `contactLeads` / `responseLeads` deixam de montar `templateComponents` literais. Passos: carregar template + bindings + lead/tenant → `resolveBindingValue` por slot → `buildTemplateComponents`. Language vem da row do catálogo, não `pt_BR` hardcoded. Se template não `APPROVED` ou slot required sem valor (depois de `—` só para lead fields; literal vazio continua skip/400 no admin, skip+warn no cron): cron não POST.

Notify deixa de usar env `WHATSAPP_NOTIFY_CUSTOMER_LEAD`.

## Risks / Trade-offs

- [Token sem `whatsapp_business_management`] → sync 403. Mitigação: documentar permissão; POST sync devolve erro Graph.
- [Deploy gym-ctrl/notifly/captura dessincronizado] → colunas/FKs quebram. Mitigação: migration + três apps juntos.
- [Configs existentes] → colunas removidas. Mitigação: seed + re-PUT; sem dual-write.
- [Template Meta muda slots] → binding incompleto. Mitigação: sync atualiza `slots`; enable e send validam cobertura; teste 400.
- [Cron dinâmico no Nest] → esquecer de re-register após PUT. Mitigação: PUT só no gym-ctrl; workers relêem no boot e a cada N minutos **ou** workers fazem poll do schedule a cada minuto e comparam (mais simples que pub/sub). **Escolha operacional:** cada worker, além do `SchedulerRegistry` no boot, **reconsulta o schedule a cada 60s** e re-registra se cron/timezone/enabled mudou (PUT no gym não precisa falar com notifly/captura).
- [Teste para qualquer número] → abuso/spam. Mitigação: só SUPER_ADMIN; log `to`, template id, user id.

## Migration Plan

1. Prisma: `wabaId` (required — preencher no SQL da migration a partir de env `WHATSAPP_WABA_ID` se presente, senão placeholder que o seed/PATCH substitui), tabelas novas, drop das quatro colunas de config, FKs nullable no create e required para `enabled=true`.
2. Seed: `wabaId`; upsert schedules default; sync (ou insert mínimo dos dois templates operacionais se Graph indisponível no seed — seed **não** deve falhar sem Meta; bindings apontam por `name+language` após sync manual).
3. Deploy gym-ctrl + notifly + captura.
4. Operação: PATCH `wabaId` real, POST sync, PUT outreach configs novas.
5. Rollback: revert migration (perda dos bindings novos).

## Open Questions

Nenhum bloqueante. JSON real da Meta (`test_gladson` vs notify) deve ser conferido no primeiro sync; o parser de slots precisa cobrir HEADER IMAGE/TEXT, BODY positional/named, BUTTON URL.
