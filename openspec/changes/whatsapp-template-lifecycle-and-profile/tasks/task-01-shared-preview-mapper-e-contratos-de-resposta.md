# Task 1 — Shared preview mapper e contratos de resposta

**Change:** `whatsapp-template-lifecycle-and-profile`
**Grupo:** 1 de 5
**Pré-requisitos:** nenhum
**Desbloqueia:** [2](./task-02-graph-media-upload-handles.md), [3](./task-03-template-lifecycle-create-edit-delete.md), [5](./task-05-contratos-front-swagger-e-verificacao.md) (parcial)

## Objetivo do grupo

Unificar o DTO de preview do catálogo e expor `components` + `slots` no platform (list + get) e no tenant (list + get grant-filtered), sem sync Graph nas leituras.

## Contexto para o subagent

- Catálogo Prisma: `WhatsappMessageTemplate` em `prisma/schema.prisma` — já tem `components Json`, `slots Json`, `metaId`, `parameterFormat`, `category`, `lastSyncedAt`.
- Platform list **já devolve** `components` em `apps/gym-ctrl/src/modules/admin/whatsapp-templates.service.ts` → `list()`.
- Tenant list **omite** `components` em `TemplateGrantsService.listGrantedTemplates` (`apps/gym-ctrl/src/modules/admin/template-grants.service.ts`).
- Controllers: `whatsapp-templates.controller.ts` (`platform/whatsapp-templates`), `tenant-templates.controller.ts` (`tenant/:tenantId/whatsapp-templates`).
- Slots: `parseTemplateSlots` em `libs/shared/whatsapp-template-slots.ts` (reexport via `@core/shared` conforme padrão do repo).
- Specs: `specs/whatsapp-template-preview/spec.md`, delta `specs/tenant-template-grants/spec.md`, delta `specs/whatsapp-template-catalog/spec.md`.
- Design D1: **não** renderizar preview no servidor; devolver shape Meta de `components`.
- Nunca citar “academia” em textos Swagger/descrições — usar “tenant”.
- Não alterar sync Graph, grants write, nem on-demand send neste grupo.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `libs/shared/whatsapp-template-preview.ts` (ou nome alinhado ao repo) | criar |
| `libs/shared/index` / barrel se existir | editar (export) |
| `apps/gym-ctrl/src/modules/admin/whatsapp-templates.service.ts` | editar |
| `apps/gym-ctrl/src/modules/admin/whatsapp-templates.controller.ts` | editar (GET `:id`) |
| `apps/gym-ctrl/src/modules/admin/template-grants.service.ts` | editar |
| `apps/gym-ctrl/src/modules/admin/tenant-templates.controller.ts` | editar (GET `:templateId`) |
| `*.spec.ts` relacionados | criar/editar |

---

## 1.1 — Extrair/centralizar mapper de row → DTO de preview

### O que fazer

Criar função pura `toTemplatePreviewDto(row)` que retorna:

```ts
{
  id: number;
  metaId: string | null;
  name: string;
  language: string;
  status: string;
  category: string | null;
  parameterFormat: string | null;
  slots: TemplateSlot[]; // via parseTemplateSlots se slots vazios
  components: unknown;   // row.components
  lastSyncedAt: Date | string;
}
```

Reusar a lógica de `asSlots` já presente em `whatsapp-templates.service.ts` / `template-grants.service.ts`. Preferir shared para gym-ctrl e futuros callers.

### Critérios de aceite

- [ ] Mapper único usado por platform e tenant
- [ ] `components` é o JSON persistido (não stripado)
- [ ] Slots estáveis (`body.1`, etc.)

### Não fazer

- Não interpolar variáveis no servidor
- Não chamar Graph

---

## 1.2 — Platform list + GET by id

### O que fazer

- Em `WhatsappTemplatesService.list`, mapear via `toTemplatePreviewDto`.
- Adicionar `getById(id)` + `GET /platform/whatsapp-templates/:id` em `WhatsappTemplatesController`.
- Cuidado com ordem de rotas Nest: `GET :id` não pode capturar `sync` (sync já é `POST`). `test` é `POST :id/test`. Colocar `GET :id` sem conflito.
- 404 se id inexistente (`NotFoundException` com mensagem clara).

### Critérios de aceite

- [ ] List inclui `components` + `slots` + metadados do spec
- [ ] GET by id happy path + 404
- [ ] Continua `SUPER_ADMIN` only

### Não fazer

- Não mudar comportamento de `POST sync` / `POST :id/test`

---

## 1.3 — Tenant list + GET by id (grant-filtered)

### O que fazer

- Ampliar `listGrantedTemplates` para retornar o DTO de preview completo (incl. `components`, `category`, `parameterFormat`, `metaId`, `lastSyncedAt`).
- Adicionar `getGrantedTemplate(tenantId, templateId)`: join grant+template; se sem grant → **404** (não 403), sem revelar existência no catálogo global.
- `GET /tenant/:tenantId/whatsapp-templates/:templateId` no `TenantTemplatesController` (mesmo guards: TenantScope, TenantActive, Roles ADMIN/SUPER_ADMIN, ApiKeyAllowlist).
- Atualizar descrição Swagger: listagem inclui `components` para preview client-side.

### Critérios de aceite

- [ ] List grant-filtered inclui `components`
- [ ] GET granted 200; ungranted 404
- [ ] Sem sync Graph

### Não fazer

- Não exigir SUPER_ADMIN no path tenant
- Não filtrar campos para API key de forma diferente do JWT ADMIN

---

## 1.4 — Testes

### O que fazer

- Estender/criar specs: `whatsapp-templates.service.spec.ts`, `template-grants.service` (se houver) / controller tenant.
- Cobrir: list tenant com components; get ungranted → 404; platform get missing → 404.

### Critérios de aceite

- [ ] Testes passam localmente (`nx`/`jest` conforme padrão do app gym-ctrl)
- [ ] Nenhum teste chama Graph real

### Não fazer

- Não adicionar e2e Meta

---

## Verificação do grupo

- Ler resposta mockada de `listGrantedTemplates`: tem `components[type=BODY].text` com `{{1}}`.
- Platform `GET :id` retorna mesmo shape.

## Handoff para próxima task

Mapper e endpoints de leitura prontos. Grupo 2 pode adicionar upload de handle; grupo 3 pode plugar create/edit/delete no mesmo service/controller platform.
