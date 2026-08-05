# Explore monodex — índice dos handoffs

Gerado em 2026-08-04 no modo `/opsx-explore`. Sem changes OpenSpec ativos na época.

| Arquivo | Destino | Uso |
|---------|---------|-----|
| [01-checklist-rodar-local.md](./01-checklist-rodar-local.md) | Agent/dev de bootstrap | Subir o monorepo localmente |
| [02-painel-super-admin.md](./02-painel-super-admin.md) | Agent de proposta | Insumo para `/opsx-propose` do painel (base) |
| [03-avaliacao-multi-tenant.md](./03-avaliacao-multi-tenant.md) | Agent de avaliação | Isolamento real vs hardcode |
| [04-avaliacao-banco-dados.md](./04-avaliacao-banco-dados.md) | Agent de avaliação | Gaps schema / o que deveria persistir |

## Conclusões rápidas da exploração

1. **Rodar:** Node 20, Postgres externo, `npm i`, prisma generate/migrate, `.env`, `*:dev`. Sem seed oficial de tenant/user.
2. **Super admin:** não existe — só `ADMIN`/`USER` de tenant + login no gym; sem UI.
3. **Multi-tenant:** schema sim, operação não (tenant 4 no captura, 8 no notifly, mapa welcome em memória).
4. **Externos:** PostgreSQL, Meta WhatsApp Cloud API, Baileys (`baileys.wfelipe.com.br`), Google Maps via Puppeteer, Docker Hub CI.
5. **DB gaps:** configs/pricing/templates/WABA/schedules no código; `Tenant.phone` já existe mas welcome não usa.
