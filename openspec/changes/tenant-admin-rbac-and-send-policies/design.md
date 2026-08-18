## Context

O gym-ctrl expõe onboarding e operação inteiros em `/admin/*` com `@RolesAuth(Roles.SUPER_ADMIN)`. `RolesGuard` só testa se alguma role pedida está no JWT — não há escopo de tenant. `ADMIN` é criado no seed/onboarding mas não opera nada. `TenantOutreachConfig` mistura preço (`costPerLead`, `cashbackOnReply`) com termostato (`leadsPerRun`, `schedule`, `categories`, `enabled`, bindings).

O notifly em `apps/notifly/src/leads.service.ts` (`contactLeads`) filtra categorias e telefones já presentes em `TenantLead` **daquele** tenant. Não filtra `cityId`. Não olha `contacted` de outros tenants. `Lead` permanece pool global (`phone + cityId`). Campanhas de lista são outro cron e ficam fora das novas travas de cidade/exclusividade.

Stakeholders: dono da plataforma (`SUPER_ADMIN`, tenant Platform) e operador da academia (`ADMIN`).

## Goals / Non-Goals

**Goals:**

- Separar superfície e autorização: `/platform/*` vs `/tenant/:tenantId/*`.
- Super Admin e Admin não se impersonam na escrita; Super Admin lê o andar do tenant.
- Pontapé: Super Admin cria recurso operacional inexistente e edita campos de Admin por 30 minutos após `createdAt`.
- Super Admin cria tenant + primeiro user; depois users = Admin.
- `Tenant.active=false` → só GET no `/tenant`; crons de envio skip.
- Políticas de cidade (allow XOR deny) e exclusividade (grafo + `respectAllTenants` + `exclusive`) no outreach de cidade, retroativas em `contacted=true` por telefone.
- Grants de template; scrape pedido pelo Admin com share do par `(cityId, category)`, nascendo `enabled=true`.

**Non-Goals:**

- Frontend/SPA.
- Aplicar cidade/exclusividade em campanhas de lista / CSV.
- Auth nos workers captura/notifly.
- Impersonation (login-as-tenant).
- Audit log dedicado, billing além de coins já existentes.
- Re-habilitar automaticamente um `ScrapeTarget` que o Super Admin desligou só porque um Admin pediu de novo.

## Decisions

### D1 — Prefixos `/platform` e `/tenant/:tenantId`

- **Escolha:** mover o que hoje é `/admin/*` de plataforma para `/platform/*`. Operação do tenant em `/tenant/:tenantId/*`. Push em `/tenant/push-subscriptions` (user do JWT, sem param).
- **Por quê:** olho nu no Swagger; `:tenantId` permite Super Admin GET cross-tenant sem cookie de “tenant atual”.
- **Alternativas:** manter `/admin` e só abrir roles (ambíguo); `/tenant` sem id (Super Admin cego).
- **BREAKING:** Postman e specs que citam `/admin/...` mudam. Sem redirect HTTP obrigatório.

Mapa resumido:

```
/platform/*                         SUPER_ADMIN
  tenants, primeiro user, coins write, WhatsApp, templates sync,
  scrape-targets globais, coverage, job schedules, ops summary,
  send-policy, template-grants, costPerLead / costPerSend

/tenant/:tenantId/*                 ADMIN (jwt.tenantId === param)
                                    SUPER_ADMIN: GET sempre;
                                    WRITE só pontapé (D3)
  outreach-config operacional, listas/leads/import, campanhas,
  inbox reply, scrape requests, users após o primeiro,
  GET coins/extrato/stats/policy/grants (read)

/tenant/push-subscriptions          qualquer JWT autenticado
```

`Tenant.phone`: PATCH em `/platform/tenants/:id` **e** `/tenant/:tenantId` (ambos).

### D2 — Guards empilhados, não um enum mágico

Hoje: `RolesGuard` em `libs/guard/roles.guard.ts`.

Novos:

1. **`TenantScopeGuard`** — em controllers `/tenant/:tenantId`. `ADMIN`/`USER`: `param.tenantId === jwt.tenantId` senão 403. `SUPER_ADMIN`: passa o escopo (a regra de escrita é D3).
2. **`TenantActiveGuard`** — métodos não-GET/HEAD em `/tenant`: se `Tenant.active=false` e o caller não está no fluxo `/platform`, 403. GET sempre permitido. Crons (notifly) skip `active=false` sem HTTP.
3. **`BootstrapWindowGuard` / helper de serviço** — Super Admin WRITE em recurso operacional: permitido se o recurso não existe (create) **ou** `now - createdAt < 30min`. Senão 403. Campos de plataforma não usam esta janela.

Constantes: `BOOTSTRAP_EDIT_WINDOW_MS = 30 * 60 * 1000`. Usar `createdAt` já persistido (sem coluna nova). Relógio: `Date.now()` servidor.

Admin nunca escreve `/platform` (403 do `RolesAuth(SUPER_ADMIN)`).

### D3 — Pontapé de 30 minutos (só campos/ações de Admin)

Recursos cobertos: `TenantOutreachConfig`, `TenantLeadList` (exceto `costPerSend`), `TenantListLead` + import, `TenantListCampaign` (exceto preço da lista), bindings, users **depois** do primeiro (Super Admin **não** cria o 2º user nem no pontapé — users ulteriores são só Admin).

- Super Admin **pode** `PUT` outreach-config se não houver row (body pode incluir campos de Admin).
- Super Admin **pode** PATCH campos de Admin dessa row enquanto `createdAt + 30min`.
- Depois: Super Admin PATCH só DTO de plataforma (`costPerLead`, `cashbackOnReply`). Campos de Admin no body → 403.
- Super Admin **pode** criar a primeira lista/campanha se o tenant ainda não tiver nenhuma, com a mesma janela no `createdAt` desse registro. Se já existir uma lista, não cria outra.
- Admin cria outreach-config se ausente, **sem** poder enviar `costPerLead`/`cashbackOnReply` (defaults `0`; runtime já não envia se `costPerLead <= 0`).

### D4 — Split de campos (não duas tabelas de outreach)

Manter `TenantOutreachConfig` uma row 1:1. Autorização por DTO/serviço:

| Campo | Dono write | Admin GET |
|-------|------------|-----------|
| `costPerLead`, `cashbackOnReply` | Super Admin sempre | sim, read-only |
| `enabled`, `schedule`, `categories`, `leadsPerRun`, `sendIntervalSeconds`, `slotBindings`, `outreachTemplateId`, `notifyTemplateId` | Admin (SA só D3) | sim |
| políticas de envio | Super Admin (modelo D5) | sim |

Campanha: espelho (`sendsPerRun`, `schedule`, `enabled`, bindings, `templateId` no grant = Admin; `costPerSend` da lista = Super Admin).

List create: Admin `POST { name }`; `costPerSend` default `0`; Super Admin `PATCH { costPerSend }` em `/platform/tenants/:id/lead-lists/:listId`. Campanha não envia se custo ≤ 0 (espelho do outreach).

### D5 — `TenantSendPolicy` 1:1, não JSON só na outreach config

Cidade e exclusividade valem no **envio de cidade** e no **pedido de scrape**, mesmo sem outreach-config.

```
TenantSendPolicy          tenantId UNIQUE
  allowedCityIds          Json  default []   // number[]
  deniedCityIds           Json  default []
  respectAllTenants       Boolean default false
  exclusive               Boolean default false

TenantRespect             tenantId + respectedTenantId UNIQUE
  // "X respeita Y": X não envia a telefone com TenantLead.contacted
  // de Y, qualquer cityId
```

XOR: se `allowedCityIds.length > 0` e `deniedCityIds.length > 0` → 400. Ambos vazios → sem restrição de cidade.

Flags globais (as duas):

- `respectAllTenants` em X → X exclui qualquer telefone `contacted=true` de **outro** tenant.
- `exclusive` em Y → **todos** os outros tenants excluem telefones que Y contactou (além do grafo).

União na seleção: próprios `TenantLead` (já hoje) ∪ grafo ∪ `respectAllTenants` ∪ tenants `exclusive`.

Retroativo: sem filtro de data. Qualquer `contacted=true` histórico conta.

Identidade do bloqueio: **`Lead.phone`**, não `Lead.id`. Mesmo telefone em duas cidades some das duas para o tenant restrito.

Não aplica a `TenantListLead` / cron de campanha.

### D6 — Grants de template

```
TenantTemplateGrant  tenantId + templateId UNIQUE
```

Super Admin CRUD em `/platform/tenants/:id/template-grants`. Um `WhatsappMessageTemplate` em N tenants.

Admin (e pontapé) só persiste `outreachTemplateId` / `notifyTemplateId` / `TenantListCampaign.templateId` / `notifyTemplateId` se o id está granted. Senão 400. Enable continua exigindo `APPROVED` + bindings completos.

Admin `GET /tenant/:id/whatsapp-templates` lista só granted (id, name, language, status, slots) — não dispara sync.

### D7 — Scrape: target global + vínculo

`ScrapeTarget` permanece `@@unique([cityId, category])`.

```
TenantScrapeTarget  tenantId + scrapeTargetId UNIQUE
```

`POST /tenant/:tenantId/scrape-targets` `{ cityName, state?, category }`:

1. Resolve/cria `City` (Admin pode cidade nova).
2. Avalia política de cidade (D5) no `cityId` resultante — 400 se fora do allow / no deny.
3. Upsert `ScrapeTarget`. **Create:** `enabled=true`. **Update do par existente:** não altera `enabled` (pedido não religa o que Super Admin desligou).
4. Upsert vínculo `TenantScrapeTarget`.

Admin `GET` só rows com vínculo. Super Admin `/platform/scrape-targets` vê todos; `PATCH enabled=false` para o cron global (captura já skip). Coverage continua Super Admin.

Pool `Lead` segue global: pedido não dona lead. Território no **send** é D5.

Denylist + cidade nova: cidade nova não está no deny → pedido permitido. Trade-off aceito; allowlist é a trava forte.

### D8 — Lock `Tenant.active` vs `outreach.enabled`

- `enabled` = Admin pausa o outreach.
- `active=false` = Super Admin trava a academia: HTTP `/tenant` mutação 403; notifly não contacta nem roda campanha de lista para aquele tenant; GET (config, inbox, extrato, stats, grants, policy) 200.

### D9 — Runtime notifly (`contactLeads`)

Além dos filtros atuais (categoria, phones já em `TenantLead` do tenant, saldo, mix premium):

1. Skip tenant `active=false` (e `enabled=false` como hoje).
2. `cityId` segundo policy (allow / deny / none).
3. `phone NOT IN` telefones contactados pelos conjuntos D5.

Não muda `apps/captura` além de continuar lendo `ScrapeTarget.enabled`.

### D10 — Users

- `POST /platform/tenants/:id/users` só se o tenant ainda não tem user (primeiro Admin). `SUPER_ADMIN` no body continua 400.
- `POST/PATCH/reset-password /tenant/:tenantId/users` = Admin (escopo). Super Admin GET lista. Sem pontapé para o 2º user.

## Risks / Trade-offs

- **[BREAKING paths `/admin`]** → Postman, specs e qualquer front interno atualizam juntos; sem dual-run.
- **[Super Admin não reseta senha do primeiro Admin]** → suporte operacional fica no Admin; aceito (sem impersonation).
- **[Denylist fura com cidade nova]** → documentar; preferir allowlist para território fechado.
- **[Janela 30 min depende de relógio do servidor / `createdAt`]** → sem NTP exótico; não pausar a janela em deploy.
- **[Exclusividade por telefone pega homônimos de cidade]** → pedido explícito; Lead identity `(phone, city)` permanece no scrape.
- **[Pedido de scrape não re-enable]** → academia pode ver target “deles” parado até Super Admin ligar; log/GET mostra `enabled`.
- **[costPerLead=0 até Super Admin precificar]** → sem envio; Admin habilita e o cron no-op com log já existente.

## Migration Plan

1. Migration Prisma: `TenantSendPolicy`, `TenantRespect`, `TenantTemplateGrant`, `TenantScrapeTarget`; seed opcional de policy vazia por tenant existente.
2. Guards + prefixos novos; controllers atuais movidos/renomeados (não manter `/admin` paralelo).
3. Split DTOs outreach/list/campaign; grants na validação de template id.
4. Notifly `contactLeads` + skip `active` nas campanhas de lista.
5. Postman: pastas Platform vs Tenant; login Super Admin vs Admin.
6. Rollback: revert migration + revert deploy gym/notifly; captura compatível (só `enabled` no target).

Tenants já em produção: policy vazia = comportamento atual de cidade/exclusividade. Outreach-config existente: `createdAt` antigo → Super Admin **já fora** da janela (só plataforma). Primeiro user já existe → Super Admin não cria outro.

## Open Questions

Nenhum bloqueante. Assunções: campanha de lista também skip `Tenant.active=false`; push PUT bloqueado se inativo (mutação); Super Admin GET de inbox permitido, POST reply não (ação de Admin).
