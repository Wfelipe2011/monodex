# Task 5 — Contratos front, Swagger e verificação

**Change:** `whatsapp-template-lifecycle-and-profile`
**Grupo:** 5 de 5
**Pré-requisitos:** [1](./task-01-shared-preview-mapper-e-contratos-de-resposta.md), [2](./task-02-graph-media-upload-handles.md), [3](./task-03-template-lifecycle-create-edit-delete.md), [4](./task-04-business-profile-do-numero.md)
**Desbloqueia:** implementação completa / handoff front

## Objetivo do grupo

Documentar contratos para o frontend externo, alinhar Swagger/Postman, e deixar checklist de smoke verificável — sem implementar UI neste repo.

## Contexto para o subagent

- Padrão de docs: `FRONT-INTEGRATION.md` em changes arquivadas (ex.: `openspec/changes/archive/2026-08-18-tenant-admin-rbac-and-send-policies/FRONT-INTEGRATION.md`, `.../2026-08-24-tenant-api-keys-on-demand-send/FRONT-INTEGRATION.md`).
- Swagger: DTOs em `apps/gym-ctrl/src/modules/admin/dto/`; `swagger-spec.json` na raiz se o projeto regenera via script — seguir o fluxo já usado no repo.
- Postman: collections sob pasta Postman do monorepo se existir; senão documentar requests no FRONT-INTEGRATION.
- **Proibido** nas docs desta change: a palavra “academia”. Usar “tenant”, “plataforma”, “WABA”, “número Cloud API”.
- Preview: explicar substituição client-side — exemplo com BODY text + `slots` + mapa `variables: { "body.1": "João" }`.
- Escopo SUPER_ADMIN vs tenant ADMIN/API key claramente tabelado.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `openspec/changes/whatsapp-template-lifecycle-and-profile/FRONT-INTEGRATION.md` | criar |
| DTOs Swagger de response preview / profile | editar/criar se faltarem |
| `swagger-spec.json` | regenerar se houver script |
| Postman (se aplicável) | editar |
| `NOTES.md` opcional com smoke checklist | criar se útil |

---

## 5.1 — Swagger / DTOs de resposta

### O que fazer

- Tipar responses de list/get template preview, create/patch template, media handle, business profile.
- Atualizar `@ApiOperation` descriptions (preview client-side; MARKETING only; 409 delete).
- Regenerar swagger-spec se o pacote tiver target (buscar `package.json` / nx project gym-ctrl).

### Critérios de aceite

- [ ] Paths novos aparecem na spec OpenAPI gerada ou nos decorators
- [ ] Exemplos incluem `components` com BODY.text

### Não fazer

- Não documentar register de telefone

---

## 5.2 — FRONT-INTEGRATION.md + Postman

### O que fazer

Criar `FRONT-INTEGRATION.md` na pasta da change cobrindo:

1. **Preview tenant (foco):** `GET /tenant/:tenantId/whatsapp-templates` e `GET .../:templateId` — shape, como montar bubble, API key vs JWT.
2. **Preview platform:** list/get.
3. **Lifecycle SUPER_ADMIN:** media → create → edit → delete (409), status PENDING.
4. **Business profile:** GET/PATCH por `whatsapp-accounts/:id`.
5. Env nova se houver (`META_APP_ID`).
6. Tabela de permissões.

Atualizar Postman com as mesmas rotas se a collection existir.

### Critérios de aceite

- [ ] Arquivo FRONT-INTEGRATION.md existe e não contém “academia”
- [ ] Exemplo JSON realista (como o lembrete_pagamento_vencido da exploração)

### Não fazer

- Não pedir implementação de tela React neste repo

---

## 5.3 — Checklist smoke

### O que fazer

Lista verificável (em FRONT-INTEGRATION ou NOTES):

- [ ] Sync ou create → tenant list mostra `components[].text`
- [ ] Variável preenchida no front substitui `{{1}}` (manual)
- [ ] POST template MARKETING → row local
- [ ] DELETE com grant → 409
- [ ] GET/PATCH profile about
- [ ] Upload media → handle → header IMAGE create **ou** profile picture

### Critérios de aceite

- [ ] Checklist escrito; itens críticos cobertos por testes automatizados das tasks 1–4 onde possível

### Não fazer

- Não marcar checkboxes de `tasks.md` como feitos sem o manager-apply

---

## Verificação do grupo

- Reviewer consegue integrar preview só lendo FRONT-INTEGRATION.md.
- OpenAPI reflete rotas novas.

## Handoff para próxima task

Change pronta para `/opsx-manager-apply` ou `/opsx:apply`. Nada mais bloqueante em artefatos OpenSpec.
