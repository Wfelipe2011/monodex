| Grupo | Arquivo de detalhes |
|-------|---------------------|
| 1 | [task-01-shared-preview-mapper-e-contratos-de-resposta.md](./tasks/task-01-shared-preview-mapper-e-contratos-de-resposta.md) |
| 2 | [task-02-graph-media-upload-handles.md](./tasks/task-02-graph-media-upload-handles.md) |
| 3 | [task-03-template-lifecycle-create-edit-delete.md](./tasks/task-03-template-lifecycle-create-edit-delete.md) |
| 4 | [task-04-business-profile-do-numero.md](./tasks/task-04-business-profile-do-numero.md) |
| 5 | [task-05-contratos-front-swagger-e-verificacao.md](./tasks/task-05-contratos-front-swagger-e-verificacao.md) |

**Ordem de execução:** 1 → 2 → 3 e 4 (4 pode paralelizar com 3 após 2) → 5

**Artefatos de contexto:** [proposal.md](./proposal.md) · [design.md](./design.md) · specs

## 1. Shared preview mapper e contratos de resposta

📄 [Detalhes](./tasks/task-01-shared-preview-mapper-e-contratos-de-resposta.md)

- [x] 1.1 Extrair/centralizar mapper de row → DTO de preview (`id`, `metaId`, `name`, `language`, `status`, `category`, `parameterFormat`, `slots`, `components`, `lastSyncedAt`)
- [x] 1.2 Garantir `GET /platform/whatsapp-templates` e novo `GET /platform/whatsapp-templates/:id` usam o mapper
- [x] 1.3 Ampliar `GET /tenant/:tenantId/whatsapp-templates` e adicionar `GET .../:templateId` com `components` + campos de preview (grant-filtered; 404 se sem grant)
- [x] 1.4 Testes unitários dos services/controllers de list/get (platform + tenant + API key path)

## 2. Graph media upload (handles)

📄 [Detalhes](./tasks/task-02-graph-media-upload-handles.md)

- [x] 2.1 Serviço de Resumable Upload Meta (default platform token) retornando `handle`
- [x] 2.2 Endpoint SUPER_ADMIN de upload (multipart) sob platform whatsapp templates/media
- [x] 2.3 Testes com fetch/upload mockados (sem token real)

## 3. Template lifecycle (create / edit / delete)

📄 [Detalhes](./tasks/task-03-template-lifecycle-create-edit-delete.md)

- [x] 3.1 DTOs e validação MARKETING (HEADER TEXT|IMAGE, BODY, FOOTER, BUTTONS; examples obrigatórios com variáveis)
- [x] 3.2 `POST /platform/whatsapp-templates` → Graph create + upsert catálogo + slots
- [x] 3.3 `PATCH /platform/whatsapp-templates/:id` → Graph edit + upsert local
- [x] 3.4 `DELETE /platform/whatsapp-templates/:id` → 409 se FKs; senão Graph delete + remove local
- [x] 3.5 Testes de create/edit/delete (sucesso, 403, 400, 409) sem chamar Graph real

## 4. Business profile do número

📄 [Detalhes](./tasks/task-04-business-profile-do-numero.md)

- [x] 4.1 `GET /platform/whatsapp-accounts/:id/business-profile` (proxy Graph)
- [x] 4.2 `PATCH /platform/whatsapp-accounts/:id/business-profile` (campos Meta + `profile_picture_handle`)
- [x] 4.3 Testes 404/403/400 e happy path com Graph mock

## 5. Contratos front, Swagger e verificação

📄 [Detalhes](./tasks/task-05-contratos-front-swagger-e-verificacao.md)

- [x] 5.1 Atualizar Swagger/DTOs de resposta e regenerar `swagger-spec.json` se aplicável
- [x] 5.2 Postman + FRONT-INTEGRATION.md (preview tenant, CRUD SUPER_ADMIN, profile; sem termo “academia”)
- [x] 5.3 Checklist manual / smoke: list tenant com components; create template PENDING; GET/PATCH profile
