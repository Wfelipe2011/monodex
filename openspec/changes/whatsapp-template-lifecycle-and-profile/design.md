## Context

O catálogo `WhatsappMessageTemplate` já persiste o JSON Meta completo em `components` (HEADER/BODY/FOOTER/BUTTONS, textos com `{{n}}`, examples) e deriva `slots` via `parseTemplateSlots`. O sync e o `GET /platform/whatsapp-templates` já devolvem `components`. O `GET /tenant/:tenantId/whatsapp-templates` (grants) omite `components` de propósito histórico — só `id/name/language/status/slots` — o que impede preview no painel do tenant.

Contas plataforma (`WhatsappAccount` com `tenantId=null`) já guardam `phoneNumberId` / `wabaId` / `tokenEnvKey`. Não há integração com business profile nem write de templates na Graph. Credenciais resolvem via `PlatformWhatsappAdminService` + env (`GRAPH_API_VERSION = v23.0`).

Stakeholders: front externo (preview + forms de envio), SUPER_ADMIN (lifecycle + perfil), ADMIN/API key do tenant (leitura de templates granted).

## Goals / Non-Goals

**Goals:**

- Contrato de preview estável: list/get devolvem `components` + `slots` + metadados suficientes para o front substituir `{{1}}` / named params no cliente.
- Foco no tenant; platform continua alinhado ao mesmo shape.
- SUPER_ADMIN cria / edita / apaga templates MARKETING (variáveis, botões, header IMAGE) na WABA default, reconciliando o catálogo local.
- SUPER_ADMIN lê e atualiza business profile do número já existente (about, description, address, email, websites, vertical, foto).
- Documentação FRONT-INTEGRATION + Swagger/Postman.

**Non-Goals:**

- Cadastrar, verificar ou registrar telefone novo na Meta.
- Fluxo completo de display name (aprovação Meta / re-register) nesta change.
- CRUD de templates por role ADMIN do tenant.
- Builder visual no backend (sem HTML render server-side).
- Alterar pricing, grants semânticos, ou payload de envio on-demand além do necessário para preview.
- Espelhar profile em colunas Prisma (MVP = proxy live à Graph).

## Decisions

### D1 — Preview: devolver `components` crus + `slots` (sem render server-side)

**Escolha:** Enriquecer respostas com o array `components` exatamente como no catálogo (shape Meta), mais `slots` já parseados, `parameterFormat`, `category`, `language`, `status`, `name`, `id`, `metaId` quando existir. O front faz `replace` dos placeholders.

**Alternativas:** (a) endpoint `/preview` que devolve body já interpolado — acopla ao form e duplica lógica; (b) DSL própria — custo sem ganho. Shape Meta já é o que o front inspecionou no JSON da listagem Graph.

**Contrato mínimo por item (tenant e platform):**

```json
{
  "id": 12,
  "metaId": "4578906895724819",
  "name": "lembrete_pagamento_vencido",
  "language": "pt_BR",
  "status": "APPROVED",
  "category": "MARKETING",
  "parameterFormat": "POSITIONAL",
  "slots": [{ "key": "body.1", "component": "body", "paramType": "text", "format": "positional", "index": 1 }],
  "components": [ /* HEADER | BODY | FOOTER | BUTTONS como na Meta */ ],
  "lastSyncedAt": "…"
}
```

Tenant list: **somente** rows granted; **sem** sync Graph. Platform list: catálogo default WABA; já tem `components` — garantir contrato documentado + `GET /platform/whatsapp-templates/:id` e `GET /tenant/:tenantId/whatsapp-templates/:templateId` (404 se sem grant).

### D2 — Lifecycle templates: rotas platform, write Graph → upsert local

**Escolha:**

| Método | Rota | Comportamento |
|--------|------|----------------|
| POST | `/platform/whatsapp-templates` | Cria na WABA (`category=MARKETING` no MVP), upsert local (`PENDING` até sync/status), parse slots |
| PATCH | `/platform/whatsapp-templates/:id` | Edit Graph pelo `metaId` (replace components), upsert local |
| DELETE | `/platform/whatsapp-templates/:id` | Delete Graph por name/id; remove local **só se** não houver FKs (grants, outreach, campanhas, on-demand); senão 409 |
| POST | `/platform/whatsapp-templates/media` (ou similar) | Upload Resumable → devolve `handle` para `header_handle` / examples |

Reutilizar token/WABA da conta **default** (mesmo critério do sync). Após create/edit, opcional `sync()` parcial ou upsert da resposta Graph.

**Escopo MVP de components:** HEADER (TEXT ou IMAGE), BODY (text + variables), FOOTER opcional, BUTTONS (URL e/ou QUICK_REPLY). Validação: samples obrigatórios quando há variáveis; nome lowercase/underscores.

**Alternativas:** só sync manual após criar no Manager — não atende o pedido de CRUD. Write sem catálogo local — quebra grants/bindings.

### D3 — Business profile: nested sob account, live Graph

**Escolha:**

- `GET /platform/whatsapp-accounts/:id/business-profile` → Graph `GET /{phone-number-id}/whatsapp_business_profile`
- `PATCH /platform/whatsapp-accounts/:id/business-profile` → Graph `POST .../whatsapp_business_profile` com campos permitidos + `messaging_product=whatsapp`
- Foto: cliente obtém handle via upload platform (mesmo endpoint de mídia ou dedicado) e manda `profile_picture_handle`

Conta deve ser plataforma (`tenantId=null`), enabled. Token via `tokenEnvKey` daquela conta (não forçar só default — números dedicados têm perfil próprio).

**Alternativa:** cache Prisma — rejeitada no MVP (drift; sync extra).

### D4 — Authz

- Preview read: igual hoje (tenant ADMIN + API key no path tenant; SUPER_ADMIN no platform).
- Create/edit/delete template + profile + media upload Meta: **somente SUPER_ADMIN**.
- Nunca expor token; `rejectSecretTokenFields` nos bodies.

### D5 — Linguagem e docs

Artefatos, Swagger e FRONT-INTEGRATION usam **tenant** / plataforma / WABA. Não usar o termo “academia” em textos desta change.

### D6 — Shared helpers

- Reusar `parseTemplateSlots` em create/edit.
- Novo helper opcional em `@core/shared` só se precisar normalizar/validar components antes do Graph (ex.: garantir `example` presente). Sem `renderPreview(variables)`.

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| Meta rejeita template (policy / category) | Persistir status `REJECTED`/`PENDING`; front mostra status; sync periódico atualiza |
| Edit limits (10/30d, 1/24h) | Propagar erro Graph 400 com mensagem clara; documentar no FRONT |
| Delete com nome locked 30d | Documentar; 409 se FKs locais; não forçar cascade de grants |
| Header IMAGE exige handle de exemplo | Endpoint de upload antes do create; examples no DTO |
| Profile foto / Resumable Upload frágil | Isolar serviço Graph upload; testes com mock fetch |
| Payload `components` grande na list tenant | Aceitável no MVP; GET by id disponível; paginação futura se necessário |
| Tenant vê texts de marketing granted | Intencional para preview; grants continuam o gate |

## Migration Plan

1. Deploy gym-ctrl com novos campos nas respostas (backward compatible: só adiciona keys).
2. Front tenant passa a usar `components` + `slots` para preview.
3. Rotas CRUD/profile só SUPER_ADMIN — sem migração de dados Prisma obrigatória.
4. Rollback: remover rotas write; listagens continuam com `components` (inofensivo) ou feature-flag se necessário.

## Open Questions

- Webhook `message_template_status_update` nesta change ou só sync cron? **Default:** sync existente + sync pós-write; webhook como follow-up se UX de PENDING for lenta.
- PATCH de display name do número? **Fora** (non-goal); só business profile.
- UTILITY/AUTHENTICATION no create? **MVP MARKETING only**; outros categories = 400 ou follow-up.
