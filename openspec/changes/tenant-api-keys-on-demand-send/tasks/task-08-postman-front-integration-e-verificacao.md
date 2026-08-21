# Task 8 — Postman, FRONT-INTEGRATION e verificação

**Change:** `tenant-api-keys-on-demand-send`
**Grupo:** 8 de 8
**Pré-requisitos:** [task-03](./task-03-admin-grant-chaves-e-preco-on-demand.md), [task-04](./task-04-midia-upload-listagem-get-publico-e-cron-de-orfaos.md), [task-05](./task-05-gym-ctrl-send-on-demand-e-dual-auth-nas-rotas-existentes.md), [task-06](./task-06-notifly-billing-on-demand-webhook-e-reserva-unificada.md), [task-07](./task-07-agendas-api-e-worker-horario.md)
**Desbloqueia:** nenhum

## Objetivo do grupo

Contrato para o PWA e integrador: Swagger, Postman, FRONT-INTEGRATION e checklist E2E do canal on-demand.

## Contexto para o subagent

- Swagger boot: `apps/gym-ctrl/src/main.ts` `DocumentBuilder` + `swagger-spec.json` na raiz. Hoje só `addBearerAuth()`. Adicionar API key header `X-API-KEY`.
- DTOs swagger existentes: `dto/swagger/*.swagger.dto.ts`.
- Tags: `Platform — *` vs `Tenant — *` (padrão das changes recentes).
- FRONT-INTEGRATION de referência: `openspec/changes/tenant-conversations-inbox/FRONT-INTEGRATION.md` e `openspec/changes/archive/2026-08-21-configurable-coin-debit-on-status/FRONT-INTEGRATION.md`.
- Postman: procurar coleção existente na raiz / `docs/` / `postman/` e estender; se não houver arquivo único, criar `openspec/changes/tenant-api-keys-on-demand-send/postman.json` ou pasta alinhada ao repo.
- `platform-job-schedules.controller.ts`: description ainda cita só dois job keys — garantir texto dos quatro.
- Seed já cobre jobs (grupo 1).

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/gym-ctrl/src/main.ts` | editar (ApiKey security) |
| DTOs / `@Api*` nos controllers novos | editar |
| `openspec/changes/tenant-api-keys-on-demand-send/FRONT-INTEGRATION.md` | criar |
| coleção Postman (path real do repo) | criar/editar |
| `swagger-spec.json` | regenerar no boot se o fluxo do repo for esse |

---

## 8.1 — Swagger e Postman

### O que fazer

Documentar:

- Platform: PATCH `apiAccessEnabled`, PATCH `costPerOnDemandSend`, GET/PUT job schedules dos novos keys.
- Tenant JWT: CRUD chaves (201 mostra `key` uma vez), media, send, sends GET, schedules.
- Dual-auth: header `X-API-KEY` nas rotas allowlist.
- Público: GET `/public/media/:publicId`.

Postman: folder “On-demand API” com login JWT, enable flag (SA), set price (SA), create key, send template, get send, upload, public GET, create schedule, cancel, conversations GET com key, request a `/platform/tenants` com key (esperar 401).

### Critérios de aceite

- [x] Swagger lista `X-API-KEY` e Bearer
- [x] Coleção cobre allowlist e 401 fora dela

### Não fazer

- Não commitar raw keys de produção

---

## 8.2 — FRONT-INTEGRATION.md

### O que fazer

Arquivo nesta change, em português, tabelas:

- Super Admin: toggle API, preço on-demand, jobs de cleanup/agenda (read/write já existentes).
- Admin PWA: criar até 3 chaves (mostrar raw **uma vez**), upload/list imagens, disparo (to, template granted, variables, imageId), listar status B, agenda data+hora SP, inbox inalterada no JWT.
- Super Admin **não** dispara, não sobe mídia, não agenda, não cria chave.
- Integrador: header, allowlist, GET público da imagem (Meta precisa HTTPS), 3 chaves, grant off = 401 imediato.
- Gates: dedicado, preço > 0, coins no webhook (não no 201).
- Status C = conversas `windowOpen` (já existente).
- Fora: cidade/lista/WS via chave.

### Critérios de aceite

- [x] Front consegue implementar sem ler o schema Prisma
- [x] Breaking: CORS `X-API-KEY`; campo novo no GET tenant/outreach

### Não fazer

- Não documentar test-send de plataforma como o canal do tenant

---

## 8.3 — Seed extra e checklist E2E

### O que fazer

Se faltar: tenant de demo com `apiAccessEnabled` false. Checklist em NOTES ou no próprio FRONT-INTEGRATION:

1. SA liga API + preço > 0 + número dedicado + template grant.
2. Admin cria chave; list não mostra raw.
3. Chave GET templates = granted.
4. Chave POST send → 201; GET send `lastStatus` null/sent; webhook delivered → coins `costPerOnDemandSend`; thread OUT template.
5. Chave GET conversations; POST texto se janela aberta.
6. Chave GET `/platform/tenants` → 401.
7. Upload + GET público 200; arquivo órfão some no job (unitário já no 4; E2E opcional).
8. Agenda hora passada 400; futura cancel ok; fire com grant revogado → FAILED sem débito.
9. Super Admin POST send → 403.

### Critérios de aceite

- [x] Checklist escrito e executável contra gym-ctrl+notifly locais
- [x] Itens críticos 1–6 e 8–9 rastreados

### Não fazer

- Não exigir E2E Graph real da Meta se o ambiente não tiver WABA; marcar o que é mock vs live

---

## Verificação do grupo

FRONT-INTEGRATION + Swagger + Postman revisados contra D8 do design.

## Handoff para próxima task

Change apply-ready. Implementação encerrada neste grupo.
