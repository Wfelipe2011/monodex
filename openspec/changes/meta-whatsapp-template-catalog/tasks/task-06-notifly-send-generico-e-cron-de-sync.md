# Task 6 — Notifly — send genérico e cron de sync

**Change:** `meta-whatsapp-template-catalog`
**Grupo:** 6 de 8
**Pré-requisitos:** [task-01](./task-01-schema-e-migration.md), [task-02](./task-02-shared-slots-bindings-e-payload-graph.md)
**Desbloqueia:** 8

## Objetivo do grupo

Cron de outreach e notify ao tenant montam o payload Graph a partir do catálogo + bindings. Sync de templates roda no schedule persistido.

## Contexto para o subagent

- `apps/notifly/src/leads.service.ts` — `contactLeads` (~254–313) e `responseLeads` (~411–551)
- `apps/notifly/src/platform-whatsapp.service.ts` — credentials send; **estender** para devolver também `wabaId` + `accountId` para sync
- `apps/notifly/src/notifly.module.ts` — ScheduleModule + HttpModule já existem
- Remover fallbacks `WHATSAPP_OUTREACH_HEADER_IMAGE_URL` e `WHATSAPP_NOTIFY_CUSTOMER_LEAD` neste arquivo
- Remover `language.code: 'pt_BR'` hardcoded; usar `template.language`
- `TenantWithOutreach` include deve trazer `outreachTemplate` e `notifyTemplate` (ou findUnique no send)
- `slotBindings` JSON: roles `outreach` e `notify`
- Cron outreach horário (`EVERY_HOUR`) **não** muda nesta change
- Design D6: poll schedule a cada 60s + `SchedulerRegistry` ( `@nestjs/schedule` já no app)

Não copiar o serviço de sync do gym-ctrl (outro app). Extrair upsert Graph+Prisma para uma função em `@core/shared` que recebe `{ templatesFromGraph }` **ou** duplicar o loop de upsert no notifly chamando o mesmo parser — duplicar o HTTP+upsert curto é aceitável se shared só tiver parse; preferir `syncWhatsappTemplates({ wabaId, token, accountId, http, prisma })` em `libs/shared` só se não puxar Nest. Melhor: `apps/notifly/src/whatsapp-template-sync.service.ts` com lógica espelhada da admin (mesmo parser).

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/notifly/src/leads.service.ts` | editar |
| `apps/notifly/src/platform-whatsapp.service.ts` | editar |
| `apps/notifly/src/whatsapp-template-sync.service.ts` | criar |
| `apps/notifly/src/dynamic-cron.service.ts` | criar (ou métodos no sync service) |
| `apps/notifly/src/notifly.module.ts` | editar |

---

## 6.1 — Send genérico

### O que fazer

`contactLeads`:

- include templates
- se `outreachTemplate` null ou status ≠ APPROVED → warn, return (não POST)
- para cada lead, `resolveBindingValue` por slot da role `outreach` com ctx lead+city+agora
- literal/header_image vazio → skip POST daquele lead (warn); `lead.*` usa `—`
- `buildTemplateComponents` + POST `name`/`language` da row
- TenantLead + coin **inalterados** após sucesso

`responseLeads` notify:

- usar `notifyTemplate` + `slotBindings.notify`
- `to` continua `tenant.phone`
- sem env `WHATSAPP_NOTIFY_CUSTOMER_LEAD`
- cashback inalterado

### Critérios de aceite

- [ ] Nenhum `outreachTemplateName` / `outreachContactText` / `headerImageUrl` no notifly
- [ ] Grep `pt_BR` no send de template some (pode restar em comentários? remover do payload)
- [ ] Grep `WHATSAPP_NOTIFY_CUSTOMER_LEAD` e `WHATSAPP_OUTREACH_HEADER_IMAGE_URL` ausentes em `leads.service.ts`

### Não fazer

- Não criar TenantLead no sync
- Não mudar mix premium / intervalo / dedup phone

---

## 6.2 — Cron sync

### O que fazer

Serviço:

- `onModuleInit`: load `PlatformJobSchedule` `WHATSAPP_TEMPLATE_SYNC`; se enabled, `addCronJob` com `cronExpression` + `timeZone`
- `setInterval` 60s: se cron/tz/enabled mudou, `deleteCronJob` + re-add
- Job: GET Graph `/{wabaId}/message_templates`, upsert igual admin
- enabled=false: não registra cron
- row ausente: fallback `0 5 * * *` America/Sao_Paulo

Nome do job estável, ex. `whatsapp-template-sync`.

### Critérios de aceite

- [ ] `@Cron` estático **não** é a fonte do horário de sync
- [ ] Sync upserta `WhatsappMessageTemplate`
- [ ] Poll 60s presente

### Não fazer

- Não expor HTTP no notifly para sync (admin já tem POST)

---

## Verificação do grupo

notifly compila; grep campos removidos.

## Handoff para próxima task

Captura (7) usa o mesmo model `PlatformJobSchedule` com a outra key. Seed (8) precisa templates no banco para FKs.
