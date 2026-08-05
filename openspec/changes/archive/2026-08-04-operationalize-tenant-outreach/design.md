## Context

Monodex já modela marketplace (`Lead` global + `TenantLead` por tenant) e finanças (`Coin` / `CoinTransaction`). O notifly envia templates via Meta Cloud API e grava `TenantLead.messageId` com o wamid da Graph para correlacionar respostas no webhook. O welcome em `/sites/welcome/:uuid` ainda resolve telefone por mapa em memória. Elegibilidade de cron usa `tenant.id: 8`. Pricing (`0.35` / cashback `0.00`), Phone Number ID e nomes de template estão no código.

Decisões de produto já fechadas na exploração:
- Leads globais; uso (envio/funil/coins) por tenant.
- WABA/número de envio da **plataforma**; cada tenant precisa de WhatsApp válido (`Tenant.phone`) para ser contatado/avisado.
- Envios oficiais **somente Cloud API** nesta change; Baileys fica legado/futuro.

## Goals / Non-Goals

**Goals:**
- Configuração de outreach lida do banco (por tenant).
- Conta Cloud API da plataforma referenciada de forma explícita (DB + secret em env).
- Welcome e notificação ao tenant baseados em `Tenant.uuid` / `Tenant.phone`.
- Cron do notifly processar **todos** os tenants elegíveis (enabled + phone + saldo), sem ID mágico.
- Documentar / preservar `messageId` como correlation id Meta (não FK para `Message`).

**Non-Goals:**
- Painel super admin / UI.
- Ativar, refatorar ou remover Baileys/`apps/captura` outbound (exceto não regressar compile se tocar shared types).
- `ScrapeJob`, fila de captura, categorias do scraper no DB.
- `PlatformUser` / role de plataforma.
- Isolamento `tenantId` em `Message`/`WhatsapContact` (pode ser follow-up).
- Histórico versionado de preços além de `CoinTransaction` existente.
- Soft-delete de Tenant.

## Decisions

### D1 — Modelo de config: tabela `TenantOutreachConfig` 1:1 com Tenant

**Escolha:** Nova tabela (não empilhar dezenas de colunas em `Tenant`).

Campos mínimos:
- `tenantId` (unique)
- `enabled` boolean default false
- `costPerLead` Float (ex.: 0.35)
- `cashbackOnReply` Float (ex.: 0.00)
- `outreachTemplateName` String (ex.: `amigavel`)
- `notifyTenantTemplateName` String (ex.: `lembrete_entrar_contato_cliente`)
- `schedule` Json — mapa dia-da-semana → horas UTC (espelha o objeto atual no cron)
- `categories` Json — lista de categorias elegíveis (ou String[] nativo Prisma se preferir)
- timestamps

**Alternativa considerada:** Colunas em `Tenant` — rejeitada por misturar identidade com política comercial e dificultar evolução.

**Alternativa:** Config “global + override” — adiada; um registro por tenant basta no estágio atual.

### D2 — Conta WhatsApp da plataforma: modelo `PlatformWhatsappAccount` (ou `WhatsappAccount` com `tenantId` null)

**Escolha:** `WhatsappAccount` com:
- `provider` enum inicial: só `CLOUD_API` (Baileys pode entrar depois no enum, sem implementar)
- `phoneNumberId` String
- `displayPhone` String?
- `tokenEnvKey` String default `WHATSAPP_TOKEN` (não persistir token)
- `tenantId` null = plataforma; nesta change só existe/usa a conta plataforma
- `enabled` boolean

Runtime: serviço lê a conta enabled da plataforma + `process.env[tokenEnvKey]`.

**Alternativa:** Só env vars (`WHATSAPP_PHONE_NUMBER_ID`) — suficiente tecnicamente, mas perde inventário/troca de número sem redeploy de envs em todos os lugares; DB deixa explícito o “recurso da plataforma”.

### D3 — Flags mínimas em Tenant

**Escolha:** Manter identidade em `Tenant` (`phone`, `uuid`, `name`). `outreachEnabled` efetivo = existência de `TenantOutreachConfig.enabled = true` **e** `phone` não nulo. Não duplicar `outreachEnabled` em Tenant nesta change.

Validação: ao criar/atualizar config `enabled=true`, exigir `Tenant.phone` preenchido.

### D4 — Welcome redirect

**Escolha:** `WhatsappController` injeta `PrismaService`, busca `Tenant` por `uuid` (sanitizar `{{1}}` como hoje), redirect `https://wa.me/+{digits}?text=...` usando `phone`. Se não achar tenant ou phone, fallback `public/index.html` (comportamento atual do else).

Remover constante `tenats`.

### D5 — Runtime do cron (notifly)

**Escolha:**
1. Cron decorator pode permanecer amplo ou periódico; filtro fino vem de `schedule` **por tenant** (ou schedule global da config se todos compartilharem — inicial: por tenant, seed com o mapa atual).
2. `findMany` tenants onde `outreachConfig.enabled` e `phone != null`.
3. Para cada um: checar saldo (`Coin` do tenant — manter padrão atual `findFirst` por tenant; se múltiplos users, documentar que o débito usa o mesmo critério atual: primeiro user do tenant / user ligado ao coin).
4. `contactLeads(tenant)` usa `costPerLead`, `outreachTemplateName`, `categories` da config; Graph URL usa `phoneNumberId` da conta plataforma.
5. `responseLeads` usa `notifyTenantTemplateName` e `cashbackOnReply`.

**Não** alterar captura Baileys nesta change. Idealmente deixar claro em comentário/README de explore que outbound produtivo é notifly.

### D6 — Marketplace inalterado no schema de Lead

`Lead` permanece global (`phone` unique). Uso continua em `TenantLead`. Sem `tenantId` em Lead.

### D7 — `messageId` em TenantLead

Manter `String?`. Semântica: WhatsApp Cloud API message id (wamid) para correlacionar `context.id` do webhook. Não criar FK para `Message`.

### D8 — Pricing único no canal Cloud

Como Baileys fica fora, o valor oficial de débito passa a ser só `TenantOutreachConfig.costPerLead` no notifly. Discrepância histórica captura=`1` vs notifly=`0.35` não é corrigida no captura agora.

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| Tenant enabled sem phone → falha no aviso SIM | Guard na config + skip no cron com log |
| Token errado / phoneNumberId stale | Fail rápido com log; token só via env |
| Schedule Json malformado | Validar shape mínimo no service; fallback “não agenda” |
| Múltiplos `Coin`/users por tenant | Manter comportamento atual documentado; follow-up de “billing user” |
| Migração com zero configs | Seed/migration de dados: criar config disabled para tenants existentes; habilitar manualmente o tenant que era `id: 8` com valores atuais |
| Regressão welcome se UUID não estiver no DB | Operar cadastro de phone/uuid antes do cutover; fallback HTML |

## Migration Plan

1. Adicionar models Prisma + `prisma migrate`.
2. Data migration / script: upsert `WhatsappAccount` plataforma com phoneNumberId atual; upsert `TenantOutreachConfig` para o tenant operacional atual (`enabled: true`, cost 0.35, templates atuais, schedule atual, categories atuais do notifly).
3. Deploy código notifly + controller welcome.
4. Validar welcome com UUID real; dry-run cron em horário de schedule; webhook SIM → aviso ao `Tenant.phone`.
5. Rollback: revert deploy; tabelas novas podem permanecer vazias (código antigo ignora). Evitar dropar colunas nesta change.

## Open Questions

- Quem é o “billing user” canônico por tenant quando há vários users com `Coin`? (hoje `findFirst` / primeiro user)
- `categories` e filtros de website ficam só na outreach config do notifly, ou há regras globais depois?
- Após esta change, o cron do captura permanece morto (comentado) indefinidamente até proposta Baileys?
