# Task 7 — Postman, seeds e contratos

**Change:** `configurable-scrape-and-premium-outreach`
**Grupo:** 7 de 8
**Pré-requisitos:** [5](./task-05-admin-campos-novos-de-outreach.md), [6](./task-06-admin-api-de-scrape-targets-e-coverage.md)
**Desbloqueia:** [8](./task-08-verificacao-e-handoff.md)

## Objetivo do grupo

Seeds e Postman refletem knobs de outreach e o catálogo de scrape, para operação sem adivinhar o payload.

## Contexto para o subagent

- `prisma/seed-outreach.ts`: upsert `TenantOutreachConfig` create/update **sem** os campos novos hoje. Adicionar `leadsPerRun: 5`, `sendIntervalSeconds: 5`, `headerImageUrl: null` (ou omitir no update se quiser não resetar customizações — **no update, não sobrescrever** os três knobs se a row já existe, para o seed idempotente não apagar um `leadsPerRun=10` operacional). No `create`, setar defaults 5/5/null.
- Collection: `postman/monodex.postman_collection.json`. Pasta `Admin — Outreach Config` (por volta da linha 296) — raw PUT precisa dos três campos. PATCH pode incluir um exemplo de `leadsPerRun`.
- Adicionar pasta `Admin — Scrape` com:
  - POST `/admin/scrape-targets` body `cityName`, `state`, `category`, `enabled`
  - GET `/admin/scrape-targets`
  - GET `/admin/scrape-targets/{{scrapeTargetId}}`
  - PATCH enabled false
  - DELETE
  - GET `/admin/scrape-coverages`
- Variável de collection `scrapeTargetId` (default `1`), test script no POST para gravar `id` (copiar o padrão de Create WhatsApp Account ~linhas 347–357).
- Auth bearer já está no nível da collection.
- Seed de scrape targets é do grupo 2 (`seed-scrape-targets.ts`); aqui só garantir que `seed-outreach.ts` não quebra o schema novo (campos required sem default no client). Se o Prisma exigir os Int no create, incluir.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `prisma/seed-outreach.ts` | editar |
| `postman/monodex.postman_collection.json` | editar |

---

## 7.1 — seed-outreach knobs

### O que fazer

`create`: `leadsPerRun: 5`, `sendIntervalSeconds: 5`, `headerImageUrl: null`.

`update`: **não** incluir esses três campos (preservar valores já gravados). Continuar atualizando templates/schedule/categories/enabled como hoje.

### Critérios de aceite

- [ ] Seed compila contra o client novo
- [ ] Re-rodar o seed não reseta `leadsPerRun` customizado

### Não fazer

- Não mudar `PLATFORM_PHONE_NUMBER_ID` / tenant default 8
- Não misturar seed de scrape neste arquivo (já é outro script)

---

## 7.2 — Postman

### O que fazer

Atualizar PUT outreach, exemplo:

```json
{
  "enabled": true,
  "costPerLead": 0.35,
  "cashbackOnReply": 0,
  "outreachTemplateName": "amigavel",
  "notifyTenantTemplateName": "lembrete_entrar_contato_cliente",
  "schedule": { "2": [18], "3": [18], "4": [13, 18] },
  "categories": ["Construtoras"],
  "leadsPerRun": 5,
  "sendIntervalSeconds": 5,
  "headerImageUrl": null
}
```

(`headerImageUrl` null: se o Postman/JSON omitir for mais seguro, omitir a chave.)

Nova pasta Scrape com as rotas do grupo 6. `gymBaseUrl` já existe.

JSON da collection deve permanecer válido (`json.parse` mental: aspas escapadas no `raw`).

### Critérios de aceite

- [ ] PUT outreach na collection inclui `leadsPerRun` e `sendIntervalSeconds`
- [ ] Pasta Scrape com POST/GET/PATCH/DELETE targets e GET coverages
- [ ] Collection JSON parseia

### Não fazer

- Não commitar tokens
- Não duplicar a pasta Auth

---

## Verificação do grupo

- Abrir o JSON da collection (parse)
- `npx ts-node prisma/seed-outreach.ts` typecheck contra Prisma client (ou `tsc` do seed)

## Handoff para próxima task

Grupo 8 faz grep/checklist final assumindo Postman e seeds alinhados.
