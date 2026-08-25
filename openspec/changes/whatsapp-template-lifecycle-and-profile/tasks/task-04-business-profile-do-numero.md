# Task 4 — Business profile do número

**Change:** `whatsapp-template-lifecycle-and-profile`
**Grupo:** 4 de 5
**Pré-requisitos:** [2](./task-02-graph-media-upload-handles.md) (para foto via handle; GET/PATCH about pode começar em paralelo após task 1)
**Desbloqueia:** [5](./task-05-contratos-front-swagger-e-verificacao.md)

## Objetivo do grupo

SUPER_ADMIN lê e atualiza o WhatsApp Business Profile de um `WhatsappAccount` de plataforma já existente (`phoneNumberId`), via proxy Graph — sem cadastrar telefone novo.

## Contexto para o subagent

- Contas: `WhatsappAccountsService` / `WhatsappAccountsController` em `apps/gym-ctrl/src/modules/admin/` — CRUD local de `phoneNumberId`, `wabaId`, `tokenEnvKey`, `isDefault`; **não** fala com Meta hoje.
- Profile Graph: `GET/POST https://graph.facebook.com/{v}/{phone-number-id}/whatsapp_business_profile`.
- Campos PATCH: `about`, `address`, `description`, `email`, `websites`, `vertical`, `profile_picture_handle` + obrigatório `messaging_product: "whatsapp"` no POST Meta.
- Token: da **própria** conta (`tokenEnvKey` + `phoneNumberId` do `:id`), não forçar só default — números dedicados têm perfil próprio.
- Reusar `getById` que exige `tenantId === null` (404 se não plataforma).
- Specs: `specs/whatsapp-phone-business-profile/spec.md`, deltas `admin-platform-config`, `platform-whatsapp-cloud`.
- Design D3: **live Graph**, sem colunas Prisma de cache no MVP.
- Fora de escopo: register phone, request_code, display name approval.
- Nunca citar “academia”; nunca devolver token.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `whatsapp-accounts.service.ts` ou `whatsapp-business-profile.service.ts` | editar/criar |
| `whatsapp-accounts.controller.ts` | editar |
| `dto/patch-whatsapp-business-profile.dto.ts` | criar |
| specs unitários | criar/editar |

---

## 4.1 — GET business-profile

### O que fazer

- Rota: `GET /platform/whatsapp-accounts/:id/business-profile`.
- Carregar account plataforma; ler token env; GET Graph.
- Mapear resposta Meta (`data` array típico) para objeto plano documentado (about, address, description, email, websites, vertical, profile_picture_url se vier).
- 404 account; 400 token ausente / Graph 4xx.

### Critérios de aceite

- [ ] SUPER_ADMIN only
- [ ] Usa `phoneNumberId` da conta `:id`
- [ ] Sem access token na response

### Não fazer

- Não criar número na Meta
- Não exigir `isDefault`

---

## 4.2 — PATCH business-profile

### O que fazer

- Rota: `PATCH /platform/whatsapp-accounts/:id/business-profile`.
- DTO whitelist dos campos; rejeitar extras perigosos; `rejectSecretTokenFields`.
- POST Graph com `messaging_product: "whatsapp"` + campos enviados.
- Sucesso: retornar profile atualizado (re-GET ou body Graph).
- `profile_picture_handle` aceito (vindo do upload task 2).

### Critérios de aceite

- [ ] about-only patch chama Graph corretamente (teste mock)
- [ ] ADMIN tenant → 403
- [ ] Graph erro → 400

### Não fazer

- Não persistir profile no Prisma
- Não implementar display name change

---

## 4.3 — Testes

### O que fazer

Mocks: account found/missing, token missing, Graph success/fail, role guard se testável no controller.

### Critérios de aceite

- [ ] Cobertura dos cenários do spec (GET dedicated number, 404, update about, update picture handle, ADMIN forbidden)

### Não fazer

- Não hit rede real

---

## Verificação do grupo

- GET/PATCH documentados no controller Swagger.
- Fluxo foto: upload handle (task 2) → PATCH profile_picture_handle.

## Handoff para próxima task

Profile API pronta para FRONT-INTEGRATION e smoke checklist.
