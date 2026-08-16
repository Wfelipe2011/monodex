# Task 7 — Captura — scrape schedule dinâmico

**Change:** `meta-whatsapp-template-catalog`
**Grupo:** 7 de 8
**Pré-requisitos:** [task-01](./task-01-schema-e-migration.md)
**Desbloqueia:** 8

## Objetivo do grupo

O scrape diário deixa de ser `@Cron('0 6 * * *')` e passa a seguir `PlatformJobSchedule` `SCRAPE`.

## Contexto para o subagent

- `apps/captura/src/captura-scraper.service.ts` linhas 32–34: `@Cron('0 6 * * *', { timeZone: 'America/Sao_Paulo' })` em `handleMorningScrape`
- `onModuleInit` loga “06:00 diário” — atualizar
- `ScheduleModule.forRoot()` já em `apps/captura/src/captura.module.ts`
- `runScrapeJob` / agrupamento por cidade **não** mudam
- Poll 60s + `SchedulerRegistry` (mesmo padrão do notifly grupo 6; pode duplicar um helper pequeno no app captura — **não** criar lib Nest compartilhada obrigatória)
- Fallback se row ausente: `0 6 * * *` `America/Sao_Paulo` enabled true
- PUT do horário é no gym-ctrl (grupo 3); captura só lê o banco

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/captura/src/captura-scraper.service.ts` | editar |
| `apps/captura/src/dynamic-scrape-cron.service.ts` | criar se ficar mais limpo fora do scraper |
| `apps/captura/src/captura.module.ts` | editar se novo provider |

---

## 7.1 — Cron dinâmico

### O que fazer

1. Remover o decorator `@Cron('0 6 * * *', …)` de `handleMorningScrape`.
2. Registrar cron dinâmico que chama o mesmo `handleMorningScrape` / `runScrapeJob` existente.
3. Reconsultar `platformJobSchedule.findUnique({ where: { jobKey: 'SCRAPE' } })` a cada 60s; re-register se `cronExpression`, `timeZone` ou `enabled` mudou.
4. `enabled: false` → deleteCronJob, não dispara.
5. Logs: expressão e timezone atuais no init e quando re-registrar.

Injetar `SchedulerRegistry` + `PrismaService`.

### Critérios de aceite

- [ ] Arquivo não contém `@Cron('0 6 * * *'`
- [ ] Com row default da migration, o job ainda equivale a 06:00 America/Sao_Paulo
- [ ] `enabled: false` não chama scrape no timer

### Não fazer

- Não alterar Google Maps scrapers
- Não alterar `ScrapeTarget` / coverage
- Não adicionar endpoint HTTP na captura

---

## Verificação do grupo

captura compila; grep do cron 6am só em seed/migration/docs da change.

## Handoff para próxima task

Postman do grupo 8 cobre PUT `SCRAPE` para `0 8 * * *` (contrato); runtime da captura já obedece após ≤60s.
