## Context

O notifly já lê `TenantOutreachConfig` (enabled, preço, templates, schedule, categorias de **contato**) e envia templates Cloud API. O captura ainda scrapa com `SCRAPE_CITY` / `SCRAPE_CATEGORIES` no código, faz skip se o phone já existe, e o `Lead` não tem cidade (`phone` é unique global). Rating/reviews são persistidos e ignorados; o lote é `shuffle + slice(0, 5)`; a imagem do header vem de env; os envios saem em rajada.

Leads são marketplace global; uso é por tenant (`TenantLead`). A WABA de envio continua da plataforma.

## Goals / Non-Goals

**Goals:**

- Scrape parametrizado por cidade × categoria no banco, operável via admin sem deploy.
- Cobertura persistida (já buscamos categoria C na cidade X) como base para controle futuro.
- Lead identificado por `(phone, cityId)`; mesmo WhatsApp em duas cidades = duas linhas.
- Upsert no scrape; categorias do Maps acumuladas no mesmo lead da cidade.
- Lote, imagem de header e intervalo entre envios configuráveis por tenant.
- Mix premium estratificado; sem filtro de website; no máximo um template por phone por tenant.

**Non-Goals:**

- Política de rotação/skip de scrape (ex. “não repetir em 30 dias”) — só persistir cobertura.
- Filtro de outreach por cidade no tenant (pool continua por categoria em todas as cidades, com dedup de phone).
- Baileys outbound / `apps/captura` `LeadsService.contactLeads`.
- UI web do painel; só API admin + Postman.
- Jitter no intervalo (5s exatos, configurável).
- Ressuscitar lead com `deletedAt` no re-scrape.
- Mudar welcome, WABA da plataforma, ou `WHATSAPP_NOTIFY_CUSTOMER_LEAD`.

## Decisions

### D1 — Identidade do lead: unique `(phone, cityId)` + categorias acumuladas

**Escolha:** Um estabelecimento por cidade. `phone` deixa de ser unique sozinho. `Lead.cityId` obrigatório (FK `City`). `category` permanece como categoria primária (última vista / primeira) para display e compat; `categories String[]` acumula todas as listagens do Maps naquela cidade.

**Por quê (produto):** O Maps lista o mesmo CNPJ/WhatsApp em mais de uma categoria. Duplicar por categoria na mesma cidade geraria dois alvos para o mesmo número — exatamente o spam que queremos evitar. Unique `(phone, cityId, category)` é pior para o mercado (um escritório, um WhatsApp, uma conversa). Last-write em `category` sozinho esconderia o lead de tenants que filtram a categoria anterior.

**Outreach:** elegível se `categories` (array) intersecta as categorias do tenant (`hasSome`). Fallback: se o array estiver vazio, usar `category`.

**Alternativa rejeitada:** unique `(phone, cityId, category)` — duas linhas, dois disparos possíveis ao mesmo WhatsApp na mesma cidade.

### D2 — Dedup de phone no disparo (nunca dois templates ao mesmo número)

**Escolha:**

1. Candidatos: excluir phones que o tenant **já** possui em algum `TenantLead` (join `Lead.phone`, qualquer `cityId`).
2. No lote: unique por `phone` (fica um `leadId`).
3. Persistir **um** `TenantLead` — o `leadId` efetivamente enviado. Clones em outras cidades não ganham linha de funil; a exclusão por phone impede recontato.

**Por quê:** Dois templates em sequência (mesmo lote ou crons seguintes) arriscam block da Meta e confundem o destinatário. Criar `TenantLead` fantasma nos clones distorceria o funil (contacted sem `messageId`).

### D3 — Classificador premium (plataforma, não por tenant)

Régua:

- `reviews*` = `reviews` se `reviews > 0`, senão `1` (cobre `0` e `null`).
- Média da categoria = média de `reviews*` de **todos** os leads não deletados cuja `categories` contém a categoria (todas as cidades). Recalcular a cada `contactLeads`.
- `rating` raw `< 4` → nunca premium.
- `Math.round(rating)` = `4` → premium se `reviews* ≥ 5% × média`.
- `Math.round(rating)` = `5` → premium se `reviews* ≥ 10% × média`.
- `4.7 → 5`, `4.4 → 4`, `4.5 → 5` (arredondamento JS).

Se o lead tem várias categorias no intersect do tenant, é premium se **qualquer** interseção passa a régua contra a média daquela categoria.

Website **não** entra no classificador nem no filtro de contato.

### D4 — Y derivado do estoque unused (estratificado)

`X = min(leadsPerRun, floor(saldo / costPerLead), phones únicos disponíveis)`.

`P` = candidatos premium unused (já filtrados por categoria/phone).  
`R` = demais candidatos.

```
Y = 0                          se P = 0
Y = min(P, round(X * P / (P+R)))
Y = min(Y, X-1)                se R > 0
```

Amostrar Y no pool premium (shuffle) e `X-Y` no comum; concatenar e shuffle de novo (premium não vai “na frente”). Se o pool for menor que X, enviar o que houver.

### D5 — Knobs no `TenantOutreachConfig`

| Campo | Tipo | Default |
|-------|------|---------|
| `leadsPerRun` | Int | 5 |
| `headerImageUrl` | String? | null → fallback `WHATSAPP_OUTREACH_HEADER_IMAGE_URL` |
| `sendIntervalSeconds` | Int | 5 |

Intervalo aplicado **entre** envios do mesmo tenant (não após o último). Sem jitter. Entre tenants no mesmo cron: também esperar o intervalo do tenant que **acabou** (o número é da plataforma).

Validação: `leadsPerRun >= 1`, `sendIntervalSeconds >= 0` (0 permitido só via API; default 5). `headerImageUrl` se presente deve ser https.

### D6 — Catálogo de scrape: Target ≠ Coverage

```
ScrapeTarget     cityId + category  unique, enabled
ScrapeCoverage   cityId + category  unique, firstRunAt, lastRunAt, lastStatus, lastLeadCount
```

Cron `0 6 * * *` America/Sao_Paulo lê targets `enabled=true`, agrupa por cidade, garante bairros (neighborhood scraper existente), roda o Google Maps scraper, upsert de leads, upsert de coverage ao fim de cada par cidade×categoria.

Remover `SCRAPE_CITY`, `SCRAPE_CATEGORIES` e o cron one-shot 20:00 (data já expirada). Se não houver target enabled, o cron no-op com log.

Admin cria/edita targets (resolve/cria `City` por name+state). Coverage é somente leitura nesta change.

### D7 — Upsert do lead no scrape

Chave: `(phone, cityId)` após limpar dígitos do phone.

- Não existe → `create` com `category`, `categories: [category]`, rating/reviews/website/name.
- Existe e `deletedAt` preenchido → **não** atualizar (não ressuscita).
- Existe ativo → update name, website, rating, reviews; `category` = categoria desta busca; `categories` = set union.

Phone vazio continua skip.

### D8 — Admin API

- Outreach PUT/PATCH/GET passam a aceitar/devolver os três campos novos (PUT: `leadsPerRun` e `sendIntervalSeconds` opcionais com default; PATCH parcial).
- `GET/POST /admin/scrape-targets`, `PATCH/DELETE /admin/scrape-targets/:id`, `GET /admin/scrape-coverages`.
- SUPER_ADMIN, mesmo padrão de guards do módulo admin. Sem token Meta no payload.

### D9 — Filtro `phone contains 153`

**Manter** — regra operacional já existente, fora do pedido de remover website. Documentar como filtro intencional residual.

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| Migration: leads sem cidade | Backfill para a `City` Pindamonhangaba (criar se não existir); unique composto só depois do backfill NOT NULL |
| Média global deixa cidade pequena com sarrafo alto | Aceito (decisão de produto: “toda a base da categoria”) |
| `categories` vazio em dados antigos | Backfill `categories = ARRAY[category]` |
| Cron de scrape com N cidades × M categorias × bairros = horas | Job serial por cidade; lock `running` já existe; cobertura registra lastRun mesmo se falhar no meio (status `partial`/`failed`) |
| Delay 5s × lote 10 × vários tenants estica o cron horário | Aceito; X capado por saldo reduz o pior caso |
| Header image URL inválida → Meta rejeita | Log + falha daquele lead (catch existente); não aborta o lote inteiro |
| Unique phone quebrado: código ainda faz `findUnique({ phone })` | Task obrigatória de grep/substituição no captura |

## Migration Plan

1. Prisma schema + migration:
   - criar cidade Pindamonhangaba se ausente;
   - `leads.city_id` nullable → backfill → NOT NULL + FK;
   - drop unique `leads.phone`; unique `(phone, city_id)`;
   - `leads.categories` `TEXT[]` NOT NULL DEFAULT `'{}'` + backfill;
   - colunas novas em `tenant_outreach_configs` com defaults 5 / 5 / null;
   - tabelas `scrape_targets`, `scrape_coverages`.
2. Seed opcional: um `ScrapeTarget` enabled para Pindamonhangaba + categorias atualmente no const (ou as do seed-outreach — **usar as do captura atual** `Construtoras` para não disparar 6 categorias sem querer). Documentar no seed.
3. Deploy captura + notifly + gym-ctrl juntos (schema compartilhado).
4. Rollback: revert deploy; migration down só se escrita — unique phone não pode voltar se já existirem duplicatas cross-city (não haverá até o primeiro scrape de segunda cidade).

## Open Questions

Nenhuma bloqueante. Premissas travadas na exploração:

- Média de reviews = categoria global (todas as cidades).
- Sem segundo template ao mesmo phone (dedup + exclusão histórica).
- Unique `(phone, cityId)` + array de categorias (não unique por categoria).
- Intervalo default 5s exatos, por tenant.
