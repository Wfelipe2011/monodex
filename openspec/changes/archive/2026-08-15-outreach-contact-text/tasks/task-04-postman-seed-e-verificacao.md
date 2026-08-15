# Task 4 — Postman, seed e verificação

**Change:** `outreach-contact-text`
**Grupo:** 4 de 4
**Pré-requisitos:** [2](./task-02-admin-outreach-contact-text.md), [3](./task-03-notifly-parametro-body-do-template.md)
**Desbloqueia:** nenhum

## Objetivo do grupo

Contratos operacionais (seed + Postman) incluem o campo; checklist de grep/validate fecha a change.

## Contexto para o subagent

- Seed: `prisma/seed-outreach.ts` — `upsertOutreachConfig`. `create` já seta knobs; `update` **não** deve resetar `leadsPerRun` / `headerImageUrl` / `sendIntervalSeconds`. Seguir o mesmo para `outreachContactText`.
- Postman: `postman/monodex.postman_collection.json`, pasta `Admin — Outreach Config`, requests PUT e PATCH.
- Prisma: `npx prisma validate`.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `prisma/seed-outreach.ts` | editar |
| `postman/monodex.postman_collection.json` | editar |

---

## 4.1 — Seed

### O que fazer

No `create` de `tenantOutreachConfig.upsert`:

```ts
outreachContactText: 'Gladson Teixeira (contador em Pindamonhagaba)',
```

No `update`: **não** incluir `outreachContactText` (não apagar customização operacional).

### Critérios de aceite

- [ ] Tenant novo pelo seed nasce com o texto de exemplo
- [ ] Re-rodar o seed não zera um texto já editado

### Não fazer

- Não mudar `outreachTemplateName` para outro template nesta task (já é `test_gladson`)

---

## 4.2 — Postman

### O que fazer

Incluir `"outreachContactText": "Gladson Teixeira (contador em Pindamonhagaba)"` no JSON raw do PUT. No PATCH, um exemplo opcional do mesmo campo (pode ser o único campo do body de exemplo ou junto de `leadsPerRun`).

### Critérios de aceite

- [ ] PUT da collection envia o campo
- [ ] PATCH da collection documenta o campo

### Não fazer

- Não criar pasta nova; só atualizar Outreach Config

---

## 4.3 — Validate e grep

### O que fazer

- `npx prisma validate`
- Grep: `outreachContactText` em schema, DTOs, `outreach-config.service.ts`, `leads.service.ts`, seed, Postman.
- Confirmar que `contactLeads` tem `type: 'body'` e **não** `parameter_name` nesse POST.

### Critérios de aceite

- [ ] validate ok
- [ ] campo presente nas camadas listadas
- [ ] outreach send é positional

### Não fazer

- Não implementar UI
- Não marcar o template Meta como aprovado

---

## Verificação do grupo

Seed create + collection PUT + grep.

## Handoff para próxima task

Change implementável em produção após PATCH nos tenants enabled e aprovação Meta do `test_gladson`.
