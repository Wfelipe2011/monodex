## Why

O scrape agendado hoje reexecuta **todos** os `ScrapeTarget` enabled a cada tick do cron, embora re-scrapes frequentes tragam poucos leads novos e consumam Puppeteer/Maps de forma desproporcional. Ao mesmo tempo, tenants precisam de refresh pontual sem resetar a política global de cooldown, e a config de outreach aceita categorias que não correspondem ao catálogo scrapeado na cidade — gerando envios vazios.

## What Changes

- Introduzir **lifecycle agendado** por par `(cityId, category)`: após uma execução agendada com `lastLeadCount >= 1`, o par entra em espera de **90 dias**; depois roda **uma vez** e passa a ser elegível apenas a cada **180 dias** (execuções subsequentes no ciclo de 6 meses).
- Manter scrape **global** (pool compartilhado); elegibilidade do cron deixa de ser “todo enabled” e passa a respeitar `nextScheduledRunAt` / fase derivada de `ScrapeCoverage`.
- Adicionar **busca imediata por tenant** (execução curta, menos bairros/scroll/leads), **sem alterar** o cooldown agendado; limite **2 disparos por dia por tenant por target**, com flag/config para desabilitar on-demand por target; persistir **cursor de progresso** (bairro/ordem) para o segundo disparo não repetir a mesma fatia.
- Aplicar **capacidade reduzida** no horário comercial (**08:00–18:00** America/Sao_Paulo) para jobs agendados; fora dessa janela capacidade plena.
- Expor **lista de categorias aceitáveis** para outreach derivada de `ScrapeTarget` (pedidos do tenant + targets enabled nas cidades permitidas pela `TenantSendPolicy`) e **restringir** writes de `categories` no `TenantOutreachConfig` a esse conjunto (**BREAKING** para categorias hoje salvas fora do catálogo).

## Capabilities

### New Capabilities

- `scrape-on-demand`: busca imediata tenant-scoped, quotas diárias, cursor de progresso e execução curta no captura.

### Modified Capabilities

- `scrape-catalog`: cooldown agendado 90d/180d, seleção elegível no cron, janela comercial de capacidade.
- `tenant-outreach-config`: allow-list de categorias derivada do catálogo scrape + validação em PUT/PATCH.
- `tenant-scrape-requests`: endpoint tenant para disparar on-demand em target linkado (e leitura de quota/cursor).

## Impact

- **Prisma**: campos de lifecycle em `ScrapeCoverage` (ou equivalente), tabela de cursor/quota on-demand, possivelmente defaults de plataforma.
- **captura**: scheduler elegível, fila/capacidade por horário, modo on-demand parcial no `GoogleMapsScraper`, locks por `(cityId, category)`.
- **gym-ctrl**: API on-demand, GET categorias elegíveis outreach, validação em `OutreachConfigService`; Swagger/Postman.
- **Operação**: targets existentes precisam backfill de `nextScheduledRunAt` / fase para não disparar todos no primeiro cron pós-deploy.
