# Task 6 — Verificação e handoff

**Change:** `outreach-quota-refill-on-failure`
**Grupo:** 6 de 6
**Pré-requisitos:** [1](./task-01-schema-e-migration.md)–[5](./task-05-webhook-failed-billing-hooks.md)
**Desbloqueia:** nenhum (change apply-ready para archive após validação)

## Objetivo do grupo

Confirmar comportamento ponta a ponta via testes automatizados + checklist manual, e deixar handoff claro (sem FRONT obrigatório).

## Contexto para o subagent

- Artefatos: `../proposal.md`, `../design.md`, specs em `../specs/`.
- Testes notifly: jest no package; padrões em `*.spec.ts` existentes.
- Sem mudança de contrato Admin/Postman obrigatória neste change.
- Não implementar features novas aqui — só gaps óbvios dos grupos 1–5.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `openspec/changes/outreach-quota-refill-on-failure/tasks.md` | editar (marcar checkboxes concluídos se aplicável ao fim do apply) |
| Opcional: nota curta em explore checklist se o time usar | editar só se necessário |

---

## 6.1 — Rodar testes e checklist

### O que fazer

Rodar testes notifly afetados (run service, refill, leads, list-campaigns, coin-debit, webhook).

Checklist manual (staging ou local com Meta mock):

| # | Cenário | Esperado |
|---|---------|----------|
| 1 | City `leadsPerRun=5`, 2 Graph fails, pool OK | ~5 accepts no tick; tryCount ≤ 15 |
| 2 | 2 webhooks `failed` em run OPEN | 2 refills (1 cada); phones ≠ failed |
| 3 | Redelivery mesmo `failed` | sem 2º refill |
| 4 | Premium fail com premium no pool | refill premium |
| 5 | Run OPEN + novo cron | skip novo batch |
| 6 | `expiresAt` passado + failed | close TTL; sem refill |
| 7 | List campaign espelha 1–3 | OK |
| 8 | On-demand failed | sem run/refill |
| 9 | Debit até target | run `TARGET_MET` |
| 10 | Pool vazio mid-refill | best effort / `EXHAUSTED` |

### Critérios de aceite

- [x] Testes automatizados relevantes passam
- [x] Checklist documentado (pass/fail) no handoff da sessão de apply

### Não fazer

- Não expandir escopo para UI de runs

---

## 6.2 — Handoff

### O que fazer

- Resumir: migration name, services novos, comportamento skip OPEN, TTL 1h, cap `*3`.
- Explicitar: sem FRONT-INTEGRATION obrigatório; operators não veem API de runs neste change.
- Marcar itens em `tasks.md` conforme conclusão real do apply.

### Critérios de aceite

- [x] Handoff menciona out-of-scope on-demand e ausência de API pública de runs

### Não fazer

- Não arquivar a change neste grupo (archive é comando separado)

---

## Verificação do grupo

- Change pronta para review / merge / eventual `/opsx-archive`.

## Handoff para próxima task

N/A.
