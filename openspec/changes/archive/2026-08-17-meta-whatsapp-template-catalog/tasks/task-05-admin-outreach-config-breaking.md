# Task 5 — Admin — outreach config breaking

**Change:** `meta-whatsapp-template-catalog`
**Grupo:** 5 de 8
**Pré-requisitos:** [task-01](./task-01-schema-e-migration.md), [task-02](./task-02-shared-slots-bindings-e-payload-graph.md)
**Desbloqueia:** 8

## Objetivo do grupo

PUT/PATCH/GET de outreach config usam FKs de catálogo + `slotBindings`; campos legado retornam 400; enable valida templates APPROVED e cobertura de slots.

## Contexto para o subagent

- `apps/gym-ctrl/src/modules/admin/outreach-config.controller.ts`
- `apps/gym-ctrl/src/modules/admin/outreach-config.service.ts` — `assertEnableAllowed` hoje exige `outreachContactText` e nomes de template
- DTOs: `dto/upsert-outreach-config.dto.ts`, `dto/patch-outreach-config.dto.ts`
- Specs: `specs/tenant-outreach-config/spec.md`, `specs/admin-platform-config/spec.md`
- `forbidNonWhitelisted` não está no pipe global do controller (`whitelist: true` apenas) — **rejeitar explicitamente** propriedades legado no service se aparecerem em `req.body` (padrão `rejectSecretTokenFields`) ou `@IsForbidden` custom. Melhor: função `rejectLegacyOutreachFields(body)` analogamente a secrets, chamada no controller PUT/PATCH.
- Campos legado: `outreachTemplateName`, `notifyTenantTemplateName`, `outreachContactText`, `headerImageUrl`
- `leadsPerRun` default 5, `sendIntervalSeconds` default 5; **sem** headerImageUrl

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `upsert-outreach-config.dto.ts` | editar |
| `patch-outreach-config.dto.ts` | editar |
| `outreach-config.service.ts` | editar |
| `outreach-config.controller.ts` | editar (docs + reject legado) |
| `reject-legacy-outreach-fields.ts` | criar (opcional, se não ficar no reject existente) |

---

## 5.1 — DTOs e persistência

### O que fazer

PUT required: `costPerLead`, `outreachTemplateId`, `notifyTemplateId`, `slotBindings`, `schedule`, `categories`.

`slotBindings` objeto:

```ts
{
  outreach: Record<string, { type: string; value?: string }>,
  notify: Record<string, { type: string; value?: string }>
}
```

Validar `type` ∈ enum fechado do design. `literal` e `header_image` exigem `value`. `header_image` value https. `literal` texto: trim, sem `\n\r\t`; se a key começa com `body.` aplicar `@MaxLength(80)`.

PATCH: todos opcionais; merge com existing.

GET devolve ids + slotBindings + relações mínimas (`outreachTemplate: { id, name, language, status }`) se include for barato — senão ids bastam e o front lista o catálogo à parte. Preferir include `select` name/language/status.

Remover campos dos DTOs (não deixar optional).

### Critérios de aceite

- [ ] PUT com `outreachContactText` → 400
- [ ] PUT sem `outreachTemplateId` → 400
- [ ] GET não contém as quatro colunas removidas

### Não fazer

- Não enviar Graph

---

## 5.2 — Enable

### O que fazer

Substituir checks de nomes/texto em `assertEnableAllowed`:

Se `enabled`:

- tenant active + phone (já existe)
- costPerLead > 0
- ambos IDs não null
- load templates; 400 se missing
- `status` APPROVED (ignore case)
- para cada slot de `parseTemplateSlots(template.components)` (ou `template.slots` persistido), existe binding na role correspondente
- literal/header_image com value não vazio

Usar slots persistidos para não divergir do parser.

### Critérios de aceite

- [ ] enable com template REJECTED → 400
- [ ] enable sem `body.1` no mapa outreach → 400
- [ ] enable válido persiste `enabled: true`

### Não fazer

- Não exigir `outreachContactText`

---

## Verificação do grupo

gym-ctrl compila; Swagger atualizado.

## Handoff para próxima task

Notifly (grupo 6) lê os novos campos; seed/Postman (grupo 8) devem usar o contrato novo.
