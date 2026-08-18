## Why

Toda a superfície de configuração vive hoje em `/admin/*` com `SUPER_ADMIN`. A role `ADMIN` existe, mas um admin de academia não opera o próprio tenant — e o dono da plataforma mistura preço, Meta e termostato do cliente no mesmo PATCH. Sem split de papéis, território (cidades) e exclusividade entre tenants não têm dono nem runtime. Agora o painel e o outreach já são data-driven; é o momento de separar plataforma de operação e aplicar as travas no cron.

## What Changes

- **BREAKING:** prefixos da API do gym-ctrl. Plataforma em `/platform/*` (`SUPER_ADMIN`). Operação do tenant em `/tenant/*` (`ADMIN` no `jwt.tenantId`). `/admin/*` deixa de ser o contrato (exceto o que for redirecionado/documentado como removido).
- Papéis **não se impersonam**: Super Admin não escreve campos/ações de Admin; Admin não escreve campos/ações de Super Admin.
- **Pontapé:** se o recurso operacional ainda não existe, Super Admin **pode criar** (inclui campos de Admin). Após `createdAt`, tem **30 minutos** para editar esses campos; depois só leitura no andar do tenant. Campos de plataforma (`costPerLead`, `costPerSend`, políticas, grants) o Super Admin edita sempre.
- Super Admin cria o **tenant e o primeiro usuário**; depois users = Admin escreve, Super Admin só lê.
- `Tenant.active=false`: o tenant autenticado só faz ações **consultivas** (GET). Cron não envia. Super Admin continua operando a plataforma (preço, coins, políticas).
- Split de `TenantOutreachConfig` / campanhas: preço e políticas = Super Admin; `enabled`, `schedule`, `categories`, knobs, `slotBindings`, escolha de template no grant = Admin.
- Grants de template: Super Admin libera um conjunto por tenant (1 template, N tenants). Admin só aponta ids desse conjunto.
- Admin pede scrape targets; par `(cidade, categoria)` continua único e **compartilhado**. Pedido nasce `enabled=true`. Admin só lista os que pediu. Allow/deny de cidade restringe o pedido.
- Políticas de envio (só outreach de cidade, não lista CSV): allowlist **XOR** denylist (vazio = sem restrição); exclusividade `X respeita Y`, `respectAllTenants` e `exclusive`, retroativa em `contacted=true` por **telefone** (qualquer cidade).
- **Não** inclui frontend/SPA, Baileys, mudança do pool global de `Lead`, nem exclusividade/cidade em campanhas de lista.

## Capabilities

### New Capabilities

- `tenant-operator-api`: prefixo `/tenant`, guards de role + escopo, lock consultivo por `Tenant.active`, janela de bootstrap de 30 minutos, `Tenant.phone` editável por ambos.
- `tenant-send-policies`: allow/deny de cidades XOR, grafo de exclusividade + flags globais, aplicação no runtime de outreach de cidade.
- `tenant-template-grants`: conjunto de templates Meta liberados por tenant; Admin escolhe ids só desse conjunto (outreach e campanhas).
- `tenant-scrape-requests`: pedido de scrape pelo Admin, share do `ScrapeTarget`, visibilidade só dos pedidos próprios, respeito à política de cidade.

### Modified Capabilities

- `super-admin-identity`: `/platform/*` exige `SUPER_ADMIN`; `ADMIN` em `/platform` = 403; Super Admin não escreve o andar do tenant fora do pontapé.
- `admin-platform-config`: split de campos de outreach; WhatsApp accounts, scrape global e knobs de preço permanecem Super Admin; paths `/platform`.
- `admin-tenant-lifecycle`: primeiro user só Super Admin; CRUD ulterior de users no `/tenant`; `active` = lock consultivo; coins credit/debit Super Admin; Admin lê saldo/extrato.
- `tenant-outreach-config`: donos por campo; políticas e grants referenciados; Admin `enabled`/schedule/categories/knobs/bindings.
- `cloud-outreach-runtime`: filtrar cidade pela política; excluir telefones `contacted` dos tenants respeitados (histórico completo); skip se `Tenant.active=false`.
- `scrape-catalog`: target continua único; `enabled=false` do Super Admin para o cron para todo mundo; pedidos de tenant não duplicam o par.
- `whatsapp-template-catalog`: Super Admin gerencia catálogo em `/platform`; Admin lista só templates granted.
- `template-slot-bindings`: escrita de bindings = Admin (ou Super Admin só no pontapé).
- `tenant-list-leads`: listas/leads/import = Admin; `costPerSend` = Super Admin (Admin vê, não edita).
- `tenant-list-campaigns`: campanhas = Admin; template no grant; knobs/schedule/bindings Admin; preço da lista Super Admin.
- `whatsapp-conversation-inbox`: inbox GET+reply = Admin no próprio tenant; Super Admin só GET.
- `admin-ops-read`: summary/count globais = Super Admin em `/platform`; stats do próprio funil = Admin GET.
- `inbox-web-push`: subscription move para `/tenant/push-subscriptions` (usuário autenticado do tenant).

## Impact

- **Schema:** `prisma/schema.prisma` + migration (políticas de cidade, exclusividade, grants, vínculos de scrape; talvez `createdAt` já existente para a janela de 30 min).
- **App gym-ctrl:** novos prefixos, guards (`RolesGuard` + escopo de tenant + lock `active` + janela bootstrap), split de DTOs/controllers, Postman.
- **App notifly:** `contactLeads` aplica cidade + exclusividade por telefone + skip tenant inativo.
- **App captura:** inalterado no algoritmo; `enabled` do target compartilhado continua sendo a trava do cron.
- **Specs atuais** que citam `SUPER_ADMIN` em `/admin/tenants/...` para operação de lista/inbox/outreach precisam de delta.
- **Fora:** frontend, workers autenticados, Meta token storage, aplicar políticas em campanhas de lista.
