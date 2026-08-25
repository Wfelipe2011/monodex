# Task 2 — Graph media upload (handles)

**Change:** `whatsapp-template-lifecycle-and-profile`
**Grupo:** 2 de 5
**Pré-requisitos:** [1](./task-01-shared-preview-mapper-e-contratos-de-resposta.md) (recomendado; pode paralelizar se não tocar nos mesmos métodos)
**Desbloqueia:** [3](./task-03-template-lifecycle-create-edit-delete.md), [4](./task-04-business-profile-do-numero.md)

## Objetivo do grupo

Permitir que SUPER_ADMIN faça upload de mídia na Meta (Resumable Upload) e receba um `handle` opaco para header IMAGE de template e `profile_picture_handle`.

## Contexto para o subagent

- Credenciais default: `PlatformWhatsappAdminService` em `apps/gym-ctrl/src/modules/admin/platform-whatsapp-admin.service.ts` (`GRAPH_API_VERSION = 'v23.0'`, token via `process.env[tokenEnvKey]`).
- Sync Graph existente usa `HttpService` axios em `whatsapp-templates.service.ts` (`rethrowGraphError` pattern — reusar).
- Resumable Upload Meta tipicamente: `POST https://graph.facebook.com/{version}/{APP_ID}/uploads` com file length/type, depois upload session. **Env necessário:** documentar `META_APP_ID` (ou nome alinhado ao projeto) se ainda não existir — não inventar app id hardcoded.
- Tenant media library (`media.service.ts`) é **local disk** para URLs públicas de envio — **não** reutilizar para handles Meta; caminho separado.
- Spec: `specs/whatsapp-template-lifecycle/spec.md` (Requirement: upload media handles).
- Auth: só `SUPER_ADMIN`; `rejectSecretTokenFields` no body se houver JSON.
- Nunca retornar access token; nunca citar “academia”.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/gym-ctrl/src/modules/admin/meta-resumable-upload.service.ts` (nome flexível) | criar |
| Controller platform (whatsapp-templates ou whatsapp-media) | criar/editar |
| DTO Swagger de resposta `{ handle: string }` | criar |
| Specs unitários com axios mock | criar |
| `.env.example` / docs se nova env `META_APP_ID` | editar |

---

## 2.1 — Serviço Resumable Upload

### O que fazer

Implementar serviço que:

1. Resolve credenciais da conta **default** plataforma (`resolveCredentials()` sem tenant).
2. Usa `META_APP_ID` (ou equivalente documentado) + token.
3. Executa o fluxo Resumable Upload da Graph e devolve `{ handle: string }`.
4. Em erro Graph 4xx → `BadRequestException` com mensagem `Graph API: …` (mesmo padrão de `rethrowGraphError`).

Validar content-types de imagem razoáveis (jpeg/png) no MVP; rejeitar arquivos vazios.

### Critérios de aceite

- [x] Handle não-vazio em sucesso mockado
- [x] Token só lido de env; nunca logado em claro em nível info
- [x] App id ausente → 400 claro

### Não fazer

- Não gravar arquivo no `TenantMedia`
- Não usar phone_number_id como upload session id

---

## 2.2 — Endpoint SUPER_ADMIN multipart

### O que fazer

- Rota sugerida: `POST /platform/whatsapp-templates/media` (ou `/platform/whatsapp-media`) com `FileInterceptor`.
- Registrar no `AdminModule` / controller existente `WhatsappTemplatesController` **antes** de rotas `:id` se necessário para não capturar `media` como id — preferir path estático `media` sob o controller.
- Swagger: summary em português; response `{ handle }`.

### Critérios de aceite

- [x] SUPER_ADMIN only
- [x] Multipart funciona no padrão Nest do repo (ver `media.controller.ts` como referência de FileInterceptor, não de storage)

### Não fazer

- Não expor endpoint em `/tenant/...`

---

## 2.3 — Testes mockados

### O que fazer

Mock `HttpService` / axios; cobrir happy path + Graph 400 + env app id missing.

### Critérios de aceite

- [x] Testes passam sem rede
- [x] Assert response sem campos de token

### Não fazer

- Não depends de WHATSAPP_TOKEN real no CI

---

## Verificação do grupo

- POST media com mock → `{ handle: "..." }`.
- Sem linhas novas em `tenant_media`.

## Handoff para próxima task

`handle` disponível para `header_handle` / examples no create de template e para `profile_picture_handle` no PATCH de business profile.
