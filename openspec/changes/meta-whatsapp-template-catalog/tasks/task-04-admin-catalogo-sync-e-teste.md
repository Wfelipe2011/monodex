# Task 4 — Admin — catálogo, sync e teste

**Change:** `meta-whatsapp-template-catalog`
**Grupo:** 4 de 8
**Pré-requisitos:** [task-02](./task-02-shared-slots-bindings-e-payload-graph.md), [task-03](./task-03-admin-whatsapp-account-e-job-schedules.md)
**Desbloqueia:** 8 (e 5 se quiser validar FKs contra catálogo)

## Objetivo do grupo

SUPER_ADMIN sincroniza templates da WABA, lista com `slots`, e dispara teste de envio sem funil/coin.

## Contexto para o subagent

- Credenciais: mesmo padrão de `apps/notifly/src/platform-whatsapp.service.ts` — conta `tenantId: null`, `enabled`, `CLOUD_API`; token `process.env[tokenEnvKey]`; Graph `v23.0`
- List: `GET https://graph.facebook.com/v23.0/{wabaId}/message_templates` (fields: id,name,language,status,category,parameter_format,components)
- Send: `POST https://graph.facebook.com/v23.0/{phoneNumberId}/messages`
- gym-ctrl **não** tem `HttpModule` hoje (`gym.module.ts` / `admin.module.ts`) — adicionar `@nestjs/axios` `HttpModule` no `AdminModule` (pacote já usado no notifly)
- Helpers: `@core/shared` parser + payload
- `rejectSecretTokenFields` em bodies
- `Lead` tem `rating`, `category`, `city` relation (`schema.prisma`)

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `admin.module.ts` | editar (HttpModule, providers) |
| `whatsapp-templates.controller.ts` | criar |
| `whatsapp-templates.service.ts` | criar |
| `dto/test-whatsapp-template.dto.ts` | criar |
| `platform-whatsapp.service.ts` em gym-ctrl **ou** helper local resolveCredentials | criar se não existir |

Preferir um `PlatformWhatsappAdminService` no gym-ctrl copiando resolve de phoneNumberId+token+wabaId — **não** importar classe do app notifly.

---

## 4.1 — Sync e list

### O que fazer

`POST /admin/whatsapp-templates/sync` — resolve conta plataforma; se `wabaId` vazio → 400; GET Graph; para cada template `parseTemplateSlots(components)` e upsert `WhatsappMessageTemplate` unique `(whatsappAccountId, name, language)`.

`GET /admin/whatsapp-templates` — query opcional `status`, `name` contains. Resposta: id, name, language, status, category, parameterFormat, slots, lastSyncedAt (components opcional; incluir para o front montar preview).

Erro Graph: 502/400 com mensagem, não 500 genérico se possível.

### Critérios de aceite

- [ ] Sync sem `wabaId` → 400
- [ ] List devolve `slots` array
- [ ] Upsert não duplica mesmo name+language

### Não fazer

- Não criar templates na Meta
- Não token no JSON

---

## 4.2 — Test send

### O que fazer

`POST /admin/whatsapp-templates/:id/test`

DTO:

```json
{ "to": "11999999999", "variables": { "body.1": "Demo" }, "leadId": 1 }
```

`to` required. `variables` record string→string, default `{}`. `leadId` optional.

Fluxo:

1. Load template; se status ≠ `APPROVED` (case-insensitive) → 400
2. Se `leadId`, load Lead+city; 404 se não existir
3. Para cada slot, valor = `variables[key]` senão resolve binding implícito só para `now.*` (sem mapa de config) e `lead.*` se lead carregado
4. Slot required ainda vazio → 400
5. POST Graph com builder shared; `to` normalizado 55
6. Return `{ wamid, to }` ou body Graph resumido
7. **Zero** `tenantLead.create`, **zero** `coin.update`

Log: user/templateId/`to` (não logar token).

Roles: só SUPER_ADMIN (já no controller).

### Critérios de aceite

- [ ] Template PENDING → 400 sem axios POST
- [ ] Slot faltando → 400
- [ ] Sucesso não cria TenantLead (código: nenhum prisma.tenantLead)

### Não fazer

- Não debitar costPerLead
- Não endpoint extra de preview da config (o front reenvia `variables`)

---

## Verificação do grupo

Controllers no AdminModule; compile.

## Handoff para próxima task

IDs de catálogo existem para FKs da outreach config (grupo 5) após um sync operacional.
