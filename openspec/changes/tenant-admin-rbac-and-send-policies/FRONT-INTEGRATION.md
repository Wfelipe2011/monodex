# Integração front — RBAC Admin vs Super Admin

Handoff para o PWA/Next (não vive neste repo). Use **este arquivo + Swagger** (`GET /api` no gym-ctrl, tags `Platform — *` e `Tenant — *`). Não é necessário ler o código Nest.

**Change:** `tenant-admin-rbac-and-send-policies`  
**Breaking:** o prefixo `/admin/*` **não existe mais**.

Login e JWT **não mudaram**: `POST /auth/login` → `{ "token": "<JWT>" }`.

---

## Como usar com o Swagger

1. Suba o gym-ctrl e abra `http://<host>:<GYM_PORT>/api` (Authorize → Bearer do login).
2. Tags **Platform** = dono da plataforma (`SUPER_ADMIN`).
3. Tags **Tenant** = operador da academia (`ADMIN` no `tenantId` do JWT). Super Admin pode **GET** Tenant; escrita operacional dele é só pontapé (30 min).
4. Este doc diz **o que a UI deve fazer**. O Swagger diz **shape exato** de request/response.

Dois logins, dois tokens. Não misture: um JWT de Admin em rota Platform → **403**.

---

## Os dois atores

Decodifique o JWT (`roles`, `tenantId`, `userId`).

| Role no JWT | Quem é | Base URL | `:tenantId` |
|-------------|--------|----------|-------------|
| `SUPER_ADMIN` | Dono do produto (tenant Platform) | `/platform/*` | qualquer id de academia |
| `ADMIN` (sem `SUPER_ADMIN`) | Operador da academia | `/tenant/:tenantId/*` | **obrigatório** `=== jwt.tenantId` |
| `USER` | Usuário final da academia | não opera estas telas (exceto push se autenticado) | — |

Super Admin **não assume** o Admin: não edita horário, volume, bindings, listas, campanhas, reply de inbox, users depois do primeiro (exceto janela de 30 min no create — ver abaixo).  
Admin **não assume** o Super Admin: não edita preço, coins credit/debit, WhatsApp da plataforma, scrape global, grants, política de cidade/exclusividade, `Tenant.active`.

`Tenant.phone`: **os dois** podem alterar (paths diferentes).

---

## O que o front precisa mudar (checklist)

1. **Trocar todas as URLs** `/admin/...` → tabela de migração abaixo.
2. **Separar duas apps ou dois layouts** (ou um shell que troca de API pela role).
3. **Outreach e campanha:** um formulário de preço (só Super Admin) e outro de operação (só Admin). GET devolve os dois; PATCH no path errado com campo proibido → **403**.
4. **Lista:** criar só `{ name }`. Mostrar `costPerSend` read-only no painel Admin; editar no painel Super Admin.
5. **Templates:** Admin só escolhe ids **granted**. Super Admin libera grants. Sem grant, enable/save → **400**.
6. **Novas telas Super Admin:** send-policy (cidades + exclusividade) e template grants.
7. **Nova tela Admin:** pedidos de scrape (só os que ele pediu).
8. **Tenant inativo (`active=false`):** UI em modo leitura (GETs ok; POST/PATCH/DELETE → **403**). Super Admin ainda opera `/platform` (reativar, preço, coins).
9. **Push:** `PUT/DELETE /tenant/push-subscriptions` (sem `:tenantId`). Deep link da notificação: `/tenant/{tenantId}/lead-lists/{listId}/leads/{leadId}`.
10. **Inbox:** GET+POST em `/tenant/.../messages`. Super Admin **não** responde (POST → 403); só lê.
11. **Users:** Super Admin cria **só o primeiro**. Equipe depois = Admin.

---

## Migração de paths (`/admin` → novo)

Substitua no client HTTP. Query/body iguais ao Swagger da tag nova, salvo onde este doc diz o contrário.

### Plataforma (era tudo `/admin`, agora `/platform`)

| Antes | Agora | Quem |
|-------|--------|------|
| `GET/POST /admin/tenants` | `GET/POST /platform/tenants` | Super Admin |
| `GET/PATCH /admin/tenants/:id` | `GET/PATCH /platform/tenants/:id` | Super Admin (`active`, `name`, `phone`) |
| `GET /admin/tenants/:tenantId/users` | `GET /platform/tenants/:tenantId/users` | Super Admin (leitura) |
| `POST /admin/tenants/:tenantId/users` | `POST /platform/tenants/:tenantId/users` | Super Admin **somente se o tenant ainda não tem user** |
| `PATCH .../users/:userId` e reset | **removidos de Platform** | ver Tenant |
| `GET .../coins` `GET .../coin-transactions` | `GET /platform/tenants/:tenantId/coins` (e transactions) | Super Admin |
| `POST .../coins/credit` `.../debit` | `POST /platform/tenants/:tenantId/coins/credit` (e debit) | Super Admin |
| `GET/PUT/PATCH .../outreach-config` | `GET/PUT/PATCH /platform/tenants/:tenantId/outreach-config` | Super Admin — **PUT só bootstrap**; **PATCH só preço** |
| `GET/POST/PATCH /admin/whatsapp-accounts` | `/platform/whatsapp-accounts` | Super Admin |
| `POST /admin/whatsapp-templates/sync` | `POST /platform/whatsapp-templates/sync` | Super Admin |
| `GET /admin/whatsapp-templates` | `GET /platform/whatsapp-templates` | Super Admin (catálogo **inteiro**) |
| `POST /admin/whatsapp-templates/:id/test` | `POST /platform/whatsapp-templates/:id/test` | Super Admin |
| scrape targets/coverages | `/platform/scrape-targets`, `/platform/scrape-coverages` | Super Admin (vê **todos**) |
| job schedules | `/platform/platform-job-schedules` | Super Admin |
| `GET /admin/health` | `GET /platform/health` | Super Admin |
| `GET /admin/ops/summary` | `GET /platform/ops/summary` | Super Admin |
| `GET /admin/leads/count` | `GET /platform/leads/count` | Super Admin |
| `GET /admin/tenants/:tenantId/leads/stats` | ainda existe em Platform **e** em Tenant | ver abaixo |

### Operação do tenant (era `/admin/tenants/:tenantId/...`)

O param **continua** `:tenantId` na URL (Admin: tem que ser o do JWT).

| Antes | Agora | Quem escreve |
|-------|--------|----------------|
| outreach-config GET/PUT/PATCH | `/tenant/:tenantId/outreach-config` | Admin — **PATCH knobs**; **sem preço no body** |
| lead-lists CRUD, import, leads | `/tenant/:tenantId/lead-lists...` | Admin |
| `POST` lista `{ name, costPerSend }` | `POST { "name" }` apenas | `costPerSend` nasce `0` |
| PATCH lista `costPerSend` | **não** no Tenant | Super Admin: `PATCH /platform/tenants/:tenantId/lead-lists/:listId` `{ "costPerSend" }` |
| category-suggestions | `GET /tenant/:tenantId/category-suggestions` | Admin |
| campanhas / sends | `/tenant/:tenantId/lead-lists/:listId/campaigns` e `.../sends` | Admin |
| inbox messages GET/POST | `/tenant/:tenantId/lead-lists/:listId/leads/:leadId/messages` | GET: Admin + Super Admin; **POST reply só Admin** |
| stats funil | `GET /tenant/:tenantId/leads/stats` | Admin (+ Super Admin GET) |
| coins leitura | `GET /tenant/:tenantId/coins` e `.../coin-transactions` | Admin (sem credit/debit) |
| users PATCH/reset | `/tenant/:tenantId/users` | Admin (create adicional, patch, reset) |
| `PUT /admin/push-subscriptions` | `PUT /tenant/push-subscriptions` | usuário autenticado; **sem** `:tenantId` |
| deep link push `/admin/tenants/{id}/lead-lists/...` | `/tenant/{tenantId}/lead-lists/{listId}/leads/{leadId}` | PWA / Service Worker |

Auth e health público: `POST /auth/login`, `GET /health-check` — iguais.

WebSocket inbox: **igual** (`ws/inbox?token=`). Rooms `tenant:{id}` e `super-admin` iguais. Só mudou o REST de mensagens e o path da push.

---

## Campos: quem edita vs quem só vê

### Outreach (`TenantOutreachConfig`)

GET (Platform ou Tenant) devolve a row **completa**, inclusive preço.

| Campo | Super Admin WRITE | Admin WRITE | Admin vê |
|-------|-------------------|-------------|----------|
| `costPerLead`, `cashbackOnReply` | sempre (`PATCH /platform/.../outreach-config`) | **403** se vier no body | sim, read-only |
| `enabled`, `schedule`, `categories`, `leadsPerRun`, `sendIntervalSeconds`, `slotBindings`, `outreachTemplateId`, `notifyTemplateId` | só se **não existir** config (PUT bootstrap) ou **&lt; 30 min** após `createdAt` | `PATCH /tenant/.../outreach-config` | sim |

`enabled=true` ainda exige: tenant `active`, `phone` preenchido, templates **granted** + `APPROVED`, bindings completos. Senão **400**.

**PUT Platform:** só cria se **não houver** row. Se já existe → **403** (não é mais upsert full).

**PUT Tenant:** cria se ausente, com `costPerLead`/`cashbackOnReply` = `0` (cron não envia até Super Admin precificar).

UI sugerida:

- Painel Super Admin: inputs de preço + botão “criar config inicial” se GET 404.
- Painel Admin: schedule, categorias, knobs, ligar/desligar, bindings, select de template **granted**. Preço como texto, não input.

### Listas e campanhas

| Ação | Path | Role |
|------|------|------|
| Criar lista | `POST /tenant/:tenantId/lead-lists` `{ "name": "..." }` | Admin |
| Renomear lista | `PATCH /tenant/.../lead-lists/:listId` `{ "name" }` | Admin (`costPerSend` no body → 403) |
| Definir preço da lista | `PATCH /platform/tenants/:tenantId/lead-lists/:listId` `{ "costPerSend": 0.4 }` | Super Admin (`0` = campanha não envia; negativo → 400) |
| Leads, import, campanhas, knobs da campanha, bindings | `/tenant/...` | Admin |
| Template da campanha | id tem que estar **granted** | senão 400 |

Campanhas **não** usam política de cidade/exclusividade (só outreach de Maps).

---

## Novos recursos (telas novas)

### 1. Grants de template — Super Admin

```
GET    /platform/tenants/:tenantId/template-grants
POST   /platform/tenants/:tenantId/template-grants   { "templateId": 10 }  // upsert 200
PUT    /platform/tenants/:tenantId/template-grants   { "templateId": 10 }  // mesmo
DELETE /platform/tenants/:tenantId/template-grants/:templateId
```

Catálogo completo (sync/test): `GET /platform/whatsapp-templates`.

Admin **não** chama o catálogo cheio. Lista o que pode usar:

```
GET /tenant/:tenantId/whatsapp-templates
```

Cada item: `id`, `name`, `language`, `status`, `slots`. **Não** dispara sync Meta. Use estes `id`s nos selects de outreach/campanha/notify.

Um template pode estar granted em **vários** tenants.

### 2. Política de envio (cidades + exclusividade) — Super Admin

Só vale para **outreach de cidade** (pool `Lead`) e para **pedido de scrape**. Não vale para CSV/lista.

```
GET/PUT /platform/tenants/:tenantId/send-policy
GET     /tenant/:tenantId/send-policy          // Admin: leitura
PUT     /tenant/:tenantId/send-policy          // 403 de propósito
```

Body PUT:

```json
{
  "allowedCityIds": [1],
  "deniedCityIds": [],
  "respectAllTenants": false,
  "exclusive": false,
  "respectTenantIds": [2, 3]
}
```

Regras de UI:

- Allowlist **ou** denylist, **nunca os dois** com itens. Ambos `[]` = sem restrição de cidade. Os dois preenchidos → **400**.
- `respectTenantIds` não pode incluir o próprio `tenantId` → **400**.
- `respectAllTenants`: este tenant não envia para telefone que **qualquer outro** já contactou (`contacted=true`), em qualquer cidade.
- `exclusive`: **todos** os outros respeitam os telefones que **este** tenant contactou.
- Grafo: “X respeita Y” = Y entra em `respectTenantIds` de X. Histórico conta (não é só daqui pra frente).
- Admin: tela read-only (“território: só cidade X”; “respeita tenants Y, Z”).

### 3. Pedidos de scrape — Admin

```
GET  /tenant/:tenantId/scrape-targets
POST /tenant/:tenantId/scrape-targets
{ "cityName": "Taubaté", "state": "SP", "category": "Construtoras" }
```

- Sem `enabled` no body.
- Par novo nasce ligado. Se o par **já existe** (Super Admin ou outro tenant), **compartilha** a mesma row; **não religa** se Super Admin desligou.
- GET Admin = só o que **este** tenant pediu (`enabled` vem na resposta — se `false`, o cron está parado para todo mundo).
- Super Admin continua com CRUD global em `/platform/scrape-targets`.
- Cidade fora da allowlist / na denylist → **400**. Sem política = pode criar cidade nova.
- Pedir scrape **não dona** o lead: o pool continua global. Quem limita o **envio** é a send-policy.

### 4. Phone do tenant — Admin

```
PATCH /tenant/:tenantId
{ "phone": "12911112222" }
```

Não envie `active` neste path → **403**. Ativar/desativar academia: `PATCH /platform/tenants/:id` `{ "active": false }`.

---

## Pontapé de 30 minutos (Super Admin)

Se o recurso operacional **ainda não existe**, Super Admin pode **criar** (PUT outreach com knobs, primeira lista/campanha).

Depois de `createdAt`, por **30 minutos** ainda pode PATCH campos de Admin. Depois → **403** nesses campos. Preço (`costPerLead`, `costPerSend`) ele edita **sempre**.

Não crie no front um relógio obrigatório: trate 403 e esconda inputs operacionais para Super Admin após o create (ou sempre esconda e deixe o Admin preencher). Reply de inbox: Super Admin **nunca**.

Users: Super Admin **nunca** cria o 2º user (403), mesmo nos 30 min.

---

## Tenant inativo (`active: false`)

| Quem | GET Tenant | POST/PATCH/DELETE Tenant | `/platform` |
|------|------------|---------------------------|-------------|
| Admin da academia | 200 | **403** | 403 (sempre) |
| Super Admin | 200 | 403 nas mutações `/tenant` | 200 (pode reativar, preço, coins) |

Cron de envio também para. UX: banner “conta bloqueada — somente consulta”, desabilitar botões de salvar/enviar/importar. Push PUT/DELETE também 403.

---

## Erros que a UI deve tratar

| HTTP | Quando | UI |
|------|--------|-----|
| 401 | sem JWT / inválido | login |
| 403 | role errada, outro tenant, campo de outro papel, janela expirada, tenant inativo, 2º user via Platform, Super Admin reply | mensagem específica; não misturar com 400 |
| 400 | validação, XOR cidades, template não granted, enable sem phone/APPROVED/bindings, `costPerSend` &lt; 0 | mostrar body da API |
| 404 | config/lista/tenant inexistente | empty state / criar |

Mensagem típica de 403: `{ "statusCode": 403, "message": "Acesso não permitido" }`.

---

## Fluxos sugeridos

### Onboarding (Super Admin)

1. `POST /platform/tenants` `{ name, phone }`
2. `POST /platform/tenants/:id/users` — **primeiro** Admin
3. `POST /platform/tenants/:id/coins/credit`
4. Grants: `POST .../template-grants` `{ templateId }`
5. `PUT /platform/tenants/:id/send-policy` (cidades / exclusividade; pode ser arrays vazios)
6. `PUT /platform/tenants/:id/outreach-config` se quiser pontapé **ou** deixar o Admin criar
7. `PATCH` preço outreach e, depois que o Admin criar lista, `PATCH` `costPerSend`

### Operação diária (Admin)

1. Login → `jwt.tenantId` em **todas** as URLs `/tenant/:tenantId`
2. `GET /tenant/:id/whatsapp-templates` → selects
3. `PATCH /tenant/:id/outreach-config` knobs/schedule/bindings/enabled
4. Listas, import, campanhas, inbox
5. Opcional: `POST /tenant/:id/scrape-targets`
6. Ver preço e extrato: GET outreach + GET coins (sem editar)

---

## Swagger — mapa rápido de tags

| Tag | Papel |
|-----|--------|
| `Platform — Tenants` | CRUD tenant + `active` |
| `Platform — Tenant Users` | list + primeiro user |
| `Platform — Coins` | GET + credit/debit |
| `Platform — Outreach Config` | GET + PUT bootstrap + PATCH preço |
| `Platform — WhatsApp *` / Job Schedules / Scrape / Ops | infraestrutura |
| `Platform — Send Policy` | GET/PUT política |
| `Platform — Template Grants` | CRUD grants |
| `Tenant — *` | operação da academia |
| `Tenant — Push` | `PUT/DELETE /tenant/push-subscriptions` |
| Auth | `POST /auth/login` |

Collection Postman: `postman/monodex.postman_collection.json` (pastas `Platform — *` e `Tenant — *`).

---

## Fora deste contrato

- Frontend neste monorepo (não existe).
- Impersonation (login-as-tenant).
- Exclusividade/cidade em campanha de lista.
- WebSocket: contrato antigo em `openspec/changes/realtime-inbox-websocket/FRONT-INTEGRATION.md` (só atualize o REST de mensagens e o deep link de push deste arquivo).
