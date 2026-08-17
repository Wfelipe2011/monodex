# Task 8 — Seed, Postman e verificação

**Change:** `meta-whatsapp-template-catalog`
**Grupo:** 8 de 8
**Pré-requisitos:** grupos 1–7
**Desbloqueia:** implementação completa / handoff

## Objetivo do grupo

Seed e Postman no contrato novo; grep garante que colunas/campos legado saíram do runtime.

## Contexto para o subagent

- `prisma/seed-outreach.ts` — hoje seta `outreachTemplateName: 'test_gladson'`, `notifyTenantTemplateName`, `outreachContactText`, `headerImageUrl`
- Conta plataforma `phoneNumberId` `1292251013966333`; adicionar `wabaId` via env `WHATSAPP_WABA_ID` ou constante documentada (não inventar um WABA falso em produção — se env ausente, string placeholder `'SET_WABA_ID'` e log warn)
- `postman/monodex.postman_collection.json` — folders outreach-config (~304) e whatsapp-accounts (~342)
- Specs de admin + catálogo
- Seed **não deve falhar** se Graph estiver down: criar `WhatsappMessageTemplate` stub `test_gladson` / `lembrete_entrar_contato_interessado` `pt_BR` `APPROVED` com `components`/`slots` mínimos compatíveis com o parser (header image + body.1 no outreach; named notify + button) **ou** findFirst por name após sync se rows já existirem
- `slotBindings` exemplo outreach: `body.1` literal Gladson…; `header.image` header_image só se o stub tiver o slot
- Notify: `lead.name`, `lead.phone`, literal `customer_lead`

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `prisma/seed-outreach.ts` | editar |
| `postman/monodex.postman_collection.json` | editar |

---

## 8.1 — Seed

### O que fazer

`upsertPlatformAccount`: setar `wabaId`.

Upsert `PlatformJobSchedule` defaults (idempotente; não sobrescrever cron custom se já existir — só create if missing).

`upsertOutreachConfig`: **não** usar colunas removidas. Resolver template ids por `name+language` na conta plataforma. Create/update `slotBindings` no create; no **update**, não resetar `slotBindings` se a row já existir (mesmo padrão antigo de knobs), mas **precisa** setar FKs se null.

Se templates stub não existirem, `create` os dois.

### Critérios de aceite

- [ ] `npx ts-node prisma/seed-outreach.ts` typecheck/compile contra o client novo
- [ ] Seed não referencia `outreachContactText`

### Não fazer

- Não commitar tokens
- Não exigir Graph no seed

---

## 8.2 — Postman

### O que fazer

Atualizar PUT/PATCH outreach-config: `outreachTemplateId`, `notifyTemplateId`, `slotBindings`; remover os quatro campos.

Accounts: incluir `wabaId` no POST.

Novos requests (SUPER_ADMIN):

- GET/PUT `/admin/platform-job-schedules/SCRAPE`
- GET/PUT `/admin/platform-job-schedules/WHATSAPP_TEMPLATE_SYNC`
- POST `/admin/whatsapp-templates/sync`
- GET `/admin/whatsapp-templates`
- POST `/admin/whatsapp-templates/{{templateId}}/test` body `{ "to": "...", "variables": {} }`

Variáveis de collection: `wabaId`, `templateId`.

### Critérios de aceite

- [ ] Collection sem `outreachContactText` nos bodies
- [ ] Requests de sync e test presentes

### Não fazer

- Não gerar frontend

---

## 8.3 — Validação

### O que fazer

Rodar `npx prisma validate`.

Grep (repo apps/, prisma/seed, postman) **não** deve achar uso de persistência:

- `outreachContactText`
- `outreachTemplateName`
- `notifyTenantTemplateName` como coluna/DTO
- `headerImageUrl` em TenantOutreachConfig/DTOs

Exceções: `openspec/` e este change / archive.

Confirmar `wabaId`, `slotBindings`, `WhatsappMessageTemplate` no schema.

### Critérios de aceite

- [ ] `prisma validate` exit 0
- [ ] Grep nos apps gym-ctrl/notifly/captura sem os campos removidos (exceto comentários de migration notes se inevitável — preferir zero)

### Não fazer

- Não implementar features novas nesta task

---

## Verificação do grupo

Checklist da change: schema + APIs + runtime + seed + Postman alinhados.

## Handoff para próxima task

Pronto para `/opsx-manager-apply`. Operação: PATCH wabaId real, POST sync, PUT configs dos tenants, conferir scrape/sync schedules.
