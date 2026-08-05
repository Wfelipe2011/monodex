# Explore monodex — índice dos handoffs

Gerado em 2026-08-04 no modo `/opsx-explore`. Sem changes OpenSpec ativos na época.

| Arquivo | Destino | Uso |
|---------|---------|-----|
| [01-checklist-rodar-local.md](./01-checklist-rodar-local.md) | Agent/dev de bootstrap | Subir o monorepo localmente |
| [02-painel-super-admin.md](./02-painel-super-admin.md) | Agent de proposta | Insumo para `/opsx-propose` do painel (base) |
| [03-avaliacao-multi-tenant.md](./03-avaliacao-multi-tenant.md) | Agent de avaliação | Isolamento real vs hardcode |
| [04-avaliacao-banco-dados.md](./04-avaliacao-banco-dados.md) | Agent de avaliação | Gaps schema / o que deveria persistir |

## Conclusões rápidas da exploração

1. **Rodar:** Node 20, Postgres externo, `npm i`, prisma generate/migrate, `.env`, `*:dev`. Seed de outreach: `prisma/seed-outreach.ts` (não bootstrap de SUPER_ADMIN).
2. **Super admin:** não existe — só `ADMIN`/`USER` + `POST /auth/login` no gym (API/Swagger, sem UI). Explore 02 (05/08): **etapa só backend** — role `SUPER_ADMIN` + endpoints `/admin/*` (tenants, users, coins, outreach-config, whatsapp-accounts, ops). Frontend fora.
3. **Multi-tenant:** schema sim; notifly pós-outreach lê configs do DB (welcome, cron, WABA). Captura ainda com hardcodes (`tenantId` 4) — ver `03`.
4. **Externos:** PostgreSQL, Meta WhatsApp Cloud API, Baileys (`baileys.wfelipe.com.br`), Google Maps via Puppeteer, Docker Hub CI.
5. **DB:** `WhatsappAccount` + `TenantOutreachConfig` já no schema; gaps restantes p/ painel: role `SUPER_ADMIN`, opcional `Tenant.active`, tensão email unique; captura/ScrapeJob/Messages fora do MVP do painel.
