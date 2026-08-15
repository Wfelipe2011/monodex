## Why

Outreach e captura ainda dependem de constantes de código (lote de 5, imagem de template na env, categorias/cidade do scrape, filtro de website, shuffle cego). Incluir uma cidade ou categoria exige deploy; o pool de `Lead` não distingue cidade; rating/reviews são gravados e ignorados. Isso trava operação e queima (ou desperdiça) o estoque de leads bons.

## What Changes

- Tornar o scrape de plataforma **configurável**: pares cidade × categoria persistidos, cron lê o banco, sem redeploy para nova busca.
- Registrar **cobertura** (quais categorias já foram buscadas por cidade) para controle futuro, sem implementar a política de rotação nesta change.
- **BREAKING**: identidade do lead passa a ser `(phone, cityId)` — o mesmo telefone pode existir em cidades diferentes; `phone` deixa de ser unique global.
- Upsert no scrape: cria se não existir; se existir, atualiza name/website/rating/reviews e acumula categorias.
- Acumular categorias no lead (um estabelecimento, várias listagens do Maps) em vez de duplicar a linha ou sobrescrever a categoria.
- Estender `TenantOutreachConfig` com lote por agendamento (`leadsPerRun`), URL da imagem de header e intervalo entre envios (default 5s).
- Misturar o lote: parte premium derivada do estoque unused do tenant; classificador por rating arredondado e reviews relativos à média **global** da categoria.
- Remover o filtro de website na seleção de contato (o campo continua persistido; o runtime não filtra por ele).
- Deduplicar por `phone` no disparo: no máximo um template por número por tenant (lote e histórico), para não spammar a Meta nem o destinatário.
- Pausar `sendIntervalSeconds` (default 5) entre templates no mesmo tenant.

## Capabilities

### New Capabilities

- `lead-city-identity`: identidade do lead por cidade (`phone` + `cityId`), categorias acumuladas, upsert no scrape.
- `scrape-catalog`: alvos de captura (cidade × categoria), cobertura persistida, cron do captura lendo o banco.
- `premium-lead-mix`: classificação premium e montagem do lote estratificado por tenant.

### Modified Capabilities

- `tenant-outreach-config`: persistir `leadsPerRun`, `headerImageUrl` e `sendIntervalSeconds` na config por tenant.
- `cloud-outreach-runtime`: aplicar lote/imagem/intervalo da config; remover filtro de website; misturar premium; dedup de phone.
- `admin-platform-config`: SUPER_ADMIN gerencia os novos campos de outreach e o catálogo de scrape (alvos + leitura de cobertura).

## Impact

- **Schema/DB:** `Lead.cityId` obrigatório, unique composto `(phone, cityId)`, `categories` (lista); `TenantOutreachConfig` ganha três campos; novos models `ScrapeTarget` e `ScrapeCoverage`; migration com backfill de cidade para leads existentes (cidade operacional atual / Pindamonhangaba).
- **Apps:** `apps/captura` (scraper service, persistência); `apps/notifly` (`leads.service.ts`); `apps/gym-ctrl` (DTOs/APIs admin de outreach + scrape).
- **Não altera:** Baileys outbound em `apps/captura` (`LeadsService.contactLeads` legado), welcome redirect, conta WhatsApp da plataforma, pricing/cashback já existentes.
- **Operação:** novos scrapes via API admin; imagem de header por tenant (env atual vira fallback); Postman precisa dos novos campos e rotas.
- **Runtime:** sem nova dependência npm; Puppeteer e Meta Graph API permanecem.
