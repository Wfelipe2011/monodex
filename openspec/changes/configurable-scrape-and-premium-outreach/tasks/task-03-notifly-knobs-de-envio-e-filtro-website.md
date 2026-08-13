# Task 3 — Notifly — knobs de envio e filtro website

**Change:** `configurable-scrape-and-premium-outreach`
**Grupo:** 3 de 8
**Pré-requisitos:** [1](./task-01-schema-e-migration.md)
**Desbloqueia:** [4](./task-04-notifly-mix-premium-e-dedup-de-phone.md)

## Objetivo do grupo

O runtime de contato lê lote, imagem e intervalo da `TenantOutreachConfig`, capando pelo saldo, e **não** filtra mais por `website`. Mix premium e dedup de phone ficam no grupo 4.

## Contexto para o subagent

- Arquivo principal: `apps/notifly/src/leads.service.ts`.
- `contactLeads(tenant)` hoje: `findMany` com filtro `website` OR (linhas ~151–161), `sort` random, `slice(0, 5)` (linhas 165–166).
- Header image hoje: `process.env.WHATSAPP_OUTREACH_HEADER_IMAGE_URL` (linhas 174–190).
- Loop de envio: `for (const lead of leadsToContact)` sem sleep.
- Cron já itera tenants elegíveis; `config` é `tenant.outreachConfig`.
- Saldo já é checado no cron com `costPerLead` (mínimo 1 lead); **aqui** capar o lote inteiro: `Math.min(config.leadsPerRun, Math.floor(saldo / config.costPerLead))`. O cron tem `findFirst` de coin — `contactLeads` deve recarregar saldo ou receber o cap. Preferir recalcular dentro de `contactLeads` para não driftar.
- Manter filtro `phone: { not: { contains: '153' } }` (D9 do design).
- `deletedAt: null` permanece.
- Tipo `TenantWithOutreach` já inclui `outreachConfig`.
- Não implementar classificador premium neste grupo (grupo 4 vai substituir o shuffle+slice). Pode deixar shuffle+slice usando o X capado como ponte — o grupo 4 troca a seleção.
- Sleep: `await new Promise((r) => setTimeout(r, config.sendIntervalSeconds * 1000))` **entre** iterações (não depois da última). Após o loop, se o cron for chamar o próximo tenant, esperar o mesmo intervalo **uma vez** no fim de `contactLeads` (design D5: “antes do próximo tenant”).
- `sendIntervalSeconds === 0` → sem espera.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/notifly/src/leads.service.ts` | editar |

---

## 3.1 — Remover filtro de website

### O que fazer

Apagar o bloco `OR: [{ website: '' }, { website: { contains: 'facebo' ... } }, ...]` do `lead.findMany` em `contactLeads`.

Não usar `website` em nenhum `where` de seleção de outreach.

### Critérios de aceite

- [ ] `contactLeads` não referencia `website` no filtro
- [ ] Filtro `153` no phone permanece
- [ ] `deletedAt: null` permanece

### Não fazer

- Não dropar a coluna `website` do schema
- Não alterar o filtro de website no captura `leads.service.ts` legado (fora de escopo)

---

## 3.2 — leadsPerRun capado por saldo

### O que fazer

Substituir `slice(0, 5)` por:

```
X = min(config.leadsPerRun, floor(balance / config.costPerLead), leads.length)
slice(0, X)
```

Se `costPerLead <= 0` (não deveria passar no enable), não enviar.

`leadsPerRun` vem do Prisma (default 5). Não deixar literal `5` como único cap.

### Critérios de aceite

- [ ] Nenhum `slice(0, 5)` hardcoded em `apps/notifly/src/leads.service.ts`
- [ ] Tenant com `leadsPerRun=10` e saldo para 10 tenta 10 (dado pool suficiente)
- [ ] Saldo para 3 e `leadsPerRun=10` tenta no máximo 3

### Não fazer

- Não debitar coins neste grupo além do decremento já existente por send
- Não implementar Y/premium (grupo 4)

---

## 3.3 — Header image da config

### O que fazer

```ts
const headerImageUrl =
  config.headerImageUrl?.trim() || process.env.WHATSAPP_OUTREACH_HEADER_IMAGE_URL;
```

Mesmo `templateComponents` de header image que já existe. Warn se ambos ausentes.

### Critérios de aceite

- [ ] URL do tenant prevalece sobre a env
- [ ] Env ainda funciona quando `headerImageUrl` é null

### Não fazer

- Não remover a env (é fallback de migração)
- Não mudar o template de notify ao tenant

---

## 3.4 — Intervalo entre envios

### O que fazer

No `for` de `leadsToContact`, após cada tentativa (sucesso ou catch), se não for o último índice, `await sleep(config.sendIntervalSeconds * 1000)`.

No fim de `contactLeads` (houve pelo menos um send tentado), `await sleep` de novo para espaçar o próximo tenant — **exceto** se `sendIntervalSeconds` for 0.

Helper privado `sleep(ms)` no service, estilo captura.

### Critérios de aceite

- [ ] Dois envios do mesmo tenant têm ≥ `sendIntervalSeconds` entre os POSTs
- [ ] Último envio do último tenant não precisa de sleep extra além da regra acima (sleep entre tenants só se houver próximo — implementar o sleep no fim de `contactLeads` é aceitável e mais simples)
- [ ] Default 5s quando o campo não foi customizado

### Não fazer

- Não adicionar jitter
- Não usar intervalo global hardcoded ignorando o tenant

---

## Verificação do grupo

- Grep `website` em `contactLeads`: só pode restar em logs, não no `where`
- Grep `slice(0, 5)` ausente
- Header usa `config.headerImageUrl`

## Handoff para próxima task

Grupo 4 substitui shuffle+slice pela mix premium + dedup de phone, reusando o cap `X` e o loop com sleep/imagem já prontos.
