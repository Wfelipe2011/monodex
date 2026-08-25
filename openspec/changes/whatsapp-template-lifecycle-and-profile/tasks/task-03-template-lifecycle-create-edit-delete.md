# Task 3 — Template lifecycle (create / edit / delete)

**Change:** `whatsapp-template-lifecycle-and-profile`
**Grupo:** 3 de 5
**Pré-requisitos:** [1](./task-01-shared-preview-mapper-e-contratos-de-resposta.md), [2](./task-02-graph-media-upload-handles.md)
**Desbloqueia:** [5](./task-05-contratos-front-swagger-e-verificacao.md)

## Objetivo do grupo

CRUD SUPER_ADMIN de templates MARKETING na WABA default via Graph, reconciliando `WhatsappMessageTemplate` local (slots + components + status), com delete protegido por FKs.

## Contexto para o subagent

- Service base: `apps/gym-ctrl/src/modules/admin/whatsapp-templates.service.ts` — já tem sync, list, testSend, `fetchAllTemplates`, `rethrowGraphError`.
- WABA/token: default account via `PlatformWhatsappAdminService.resolveCredentials()`.
- Create Graph: `POST /{wabaId}/message_templates` body `{ name, language, category, parameter_format?, components }`.
- Edit Graph: `POST /{template-meta-id}` com components (Meta full replace) — confirmar path na doc v23; usar `metaId` da row.
- Delete Graph: `DELETE /{wabaId}/message_templates?name=` ou by id — alinhar à doc; depois delete local.
- Unique local: `@@unique([whatsappAccountId, name, language])` no default account.
- FKs que bloqueiam delete (409): `TenantTemplateGrant`, `TenantOutreachConfig` (outreach/notify), `TenantListCampaign` (template/notify), `TenantOnDemandSend`, `TenantOnDemandSchedule` — verificar nomes exatos no `schema.prisma`.
- MVP: **somente** `category: MARKETING`; outros → 400.
- HEADER IMAGE exige example/`header_handle` (cliente obtém via task 2).
- Após create/edit: upsert local + `parseTemplateSlots`; status da resposta Graph (`PENDING`/`APPROVED`/…).
- Spec: `specs/whatsapp-template-lifecycle/spec.md`.
- Auth: `Roles.SUPER_ADMIN` no controller platform.
- Nunca citar “academia”.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `dto/create-whatsapp-template.dto.ts` | criar |
| `dto/patch-whatsapp-template.dto.ts` | criar |
| `whatsapp-templates.service.ts` | editar |
| `whatsapp-templates.controller.ts` | editar |
| `whatsapp-templates.service.spec.ts` | editar |
| shared validation helper (opcional) | criar |

---

## 3.1 — DTOs e validação MARKETING

### O que fazer

DTOs class-validator + Swagger:

- Create: `name` (regex lowercase/underscore), `language` (ex. `pt_BR`), `category` literal `MARKETING`, `parameterFormat` opcional `POSITIONAL`|`NAMED`, `components` array.
- Validar estrutura mínima: BODY obrigatório; se placeholders no text → `example` presente; HEADER IMAGE → handle/example.
- Patch: components (e campos editáveis alinhados à Meta); não permitir mudar `name`/`language` se Meta não permitir — se incerto, documentar no DTO e rejeitar mudanças de name/language com 400.

### Critérios de aceite

- [ ] Category ≠ MARKETING → 400
- [ ] IMAGE sem handle → 400 antes do Graph

### Não fazer

- Não aceitar AUTHENTICATION/UTILITY no MVP

---

## 3.2 — POST create

### O que fazer

`POST /platform/whatsapp-templates`:

1. Resolve default creds + `wabaId`.
2. POST Graph.
3. Upsert Prisma no `accountId` default com `metaId`, `components`, `slots`, `status`, `lastSyncedAt=now`.
4. Retornar `toTemplatePreviewDto`.

### Critérios de aceite

- [ ] Row local criada/atualizada
- [ ] 403 para não SUPER_ADMIN (controller)
- [ ] Erros Graph 4xx → 400

### Não fazer

- Não criar grants automaticamente

---

## 3.3 — PATCH edit

### O que fazer

`PATCH /platform/whatsapp-templates/:id`:

- 404 se row ausente; 400 se `metaId` null.
- Graph edit; em falha **não** sobrescrever local com sucesso falso.
- Sucesso → update components/slots/status.

### Critérios de aceite

- [ ] Local atualizado só após Graph OK
- [ ] metaId null → 400

### Não fazer

- Não editar via name se metaId existe (preferir id Meta)

---

## 3.4 — DELETE com 409

### O que fazer

Antes do Graph:

```ts
// count grants, outreach FKs, campaigns, on-demand sends/schedules
```

Se count > 0 → `ConflictException` 409 com mensagem listando o tipo de referência (sem dados sensíveis).

Senão: Graph delete + `prisma.whatsappMessageTemplate.delete`.

### Critérios de aceite

- [ ] Grant existente → 409, row permanece
- [ ] Sem FKs + Graph OK → row removida

### Não fazer

- Não cascade delete grants
- Não soft-delete a menos que o projeto já use esse padrão (não usa)

---

## 3.5 — Testes

### O que fazer

Mock HttpService + Prisma: create sucesso, IMAGE sem handle, delete 409, edit sem metaId, category inválida.

### Critérios de aceite

- [ ] Suite verde sem rede
- [ ] Nenhum assert exige token real

### Não fazer

- Não alterar testes de test-send além do necessário para compilar

---

## Verificação do grupo

- Fluxo mental: upload handle → POST template → GET preview com BODY text → DELETE bloqueado se grant.

## Handoff para próxima task

Lifecycle pronto. Grupo 4 (profile) independente de create; grupo 5 documenta rotas novas.
