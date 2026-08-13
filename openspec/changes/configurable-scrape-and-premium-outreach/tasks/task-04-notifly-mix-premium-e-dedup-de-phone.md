# Task 4 — Notifly — mix premium e dedup de phone

**Change:** `configurable-scrape-and-premium-outreach`
**Grupo:** 4 de 8
**Pré-requisitos:** [3](./task-03-notifly-knobs-de-envio-e-filtro-website.md)
**Desbloqueia:** [8](./task-08-verificacao-e-handoff.md)

## Objetivo do grupo

Selecionar o lote por interseção de categorias, no máximo um phone por tenant (histórico + lote), e misturar premium/comuns com Y derivado do estoque unused.

## Contexto para o subagent

- Continuar em `apps/notifly/src/leads.service.ts` (`contactLeads`).
- Grupo 3 já removeu website, capou X, delay e imagem. **Não reverter**.
- `Lead.categories` é `String[]`; `Lead.category` ainda existe. Filtro Prisma:

```ts
OR: [
  { categories: { hasSome: tenantCategories } },
  { AND: [{ categories: { isEmpty: true } }, { category: { in: tenantCategories } }] },
]
```

(`isEmpty` no Prisma 6 para arrays; se não existir, filtrar in-memory os vazios. Preferir `hasSome` + fallback in-memory se o client reclamar.)

- Dedup histórico: phones já em `TenantLead` deste tenant, **qualquer** `lead.cityId`:

```ts
const used = await this.prisma.tenantLead.findMany({
  where: { tenantId: tenant.id },
  select: { lead: { select: { phone: true } } },
});
const usedPhones = new Set(used.map((t) => t.lead.phone));
```

Excluir no `where` (`phone: { notIn: [...] }`) se o set não for enorme; se for, filtrar in-memory. Lista de phones pode ser grande — `notIn` é ok na escala atual.

- Dedup no lote: um lead por `phone` (primeiro após shuffle do pool, ou Map).
- Um `TenantLead.create` só para o `leadId` enviado (já no transaction). **Não** criar linhas para clones de outras cidades.
- Extrair helpers privados no mesmo service (ou ficheiro sibling `premium-mix.ts` em `apps/notifly/src/` se o arquivo passar de ~200 linhas novas). Preferir sibling para testabilidade mental:

  - `coalesceReviews(reviews: number | null): number` → `reviews > 0 ? reviews : 1`
  - `premiumTier(rating: number | null): 4 | 5 | null` → se `rating == null || rating < 4` então null; senão `Math.round(rating)` se 4 ou 5, senão null (`Math.round(4.7)===5`, `Math.round(4.4)===4`, `Math.round(4.5)===5`)
  - `isPremium(lead, avgByCategory, tenantCategories): boolean`

- Média: todos os leads `deletedAt: null` cuja `categories` contém a categoria (ou `category` se array vazio). Todas as cidades. Inclui já contactados. Recalcular por `contactLeads` (um `groupBy` in-memory após `findMany` de `{ categories, category, reviews }` ou SQL raw). Escala atual: carregar reviews/categories de todos os não-deletados daquelas categorias do tenant.

- Fórmula Y (P = count premium unused, R = count comum unused, X = cap do grupo 3 limitado ao pool unique-phone):

```
Y = 0 se P === 0
senão Y = min(P, Math.round(X * P / (P + R)))
se R > 0: Y = min(Y, X - 1)
```

Shuffle premium, take Y; shuffle comum, take X-Y; concat; shuffle. Se P+R < X, usar o disponível.

- Método morto `shuffleLeads` no fim do service: pode reusar ou apagar se ninguém chama. Não deixar Fisher-Yates errado: `sort(() => Math.random() - 0.5)` já é o padrão do ficheiro — aceitável.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/notifly/src/leads.service.ts` | editar |
| `apps/notifly/src/premium-mix.ts` (opcional) | criar |

---

## 4.1 — Interseção de categorias

### O que fazer

Trocar `category: { in: categories }` por interseção com `Lead.categories` + fallback `category` quando o array está vazio (dados antigos mal backfilled).

`categories` do tenant continua `asStringArray(config.categories)`. Se vazio, não selecionar leads (log).

### Critérios de aceite

- [ ] Lead com `categories: ['Construtoras','Consultorias']` entra se o tenant só tem `Construtoras`
- [ ] Lead só com `category: 'X'` e `categories: []` ainda entra se o tenant tem `X`

### Não fazer

- Não filtrar por `cityId` do tenant (non-goal)

---

## 4.2 — Dedup de phone

### O que fazer

1. Excluir phones já ligados a qualquer `TenantLead` do tenant.
2. No pool restante, unique por `phone` antes de calcular P/R/X.
3. Envio cria um `TenantLead` no `leadId` escolhido.

### Critérios de aceite

- [ ] Dois leads mesmo phone, cidades diferentes → no máximo um no lote
- [ ] Após contactar Pinda, o clone Taubaté do mesmo phone **não** é candidato
- [ ] Outro tenant ainda pode contactar esse phone (marketplace)

### Não fazer

- Não criar `TenantLead` fantasma nos clones
- Não enviar dois templates no mesmo `for`

---

## 4.3 — Classificador premium

### O que fazer

Implementar D3 do design:

- `reviews*` = 0/null → 1 (lead e média)
- média da categoria = mean de `reviews*` em **todas** as cidades, leads não deletados cuja lista de categorias contém a categoria
- `rating < 4` → não premium
- round 4 → `reviews* >= 0.05 * avg`
- round 5 → `reviews* >= 0.10 * avg`
- várias categorias no intersect do tenant: premium se **qualquer** passa

Website ignorado.

### Critérios de aceite

- [ ] 4.7 + reviews no sarrafo de 10% → premium
- [ ] 3.9 → nunca premium
- [ ] 4.4 no sarrafo de 5% → premium
- [ ] Média usa as duas cidades da mesma categoria

### Não fazer

- Não persistir “isPremium” no banco
- Não tornar limiares configuráveis por tenant

---

## 4.4 — Lote estratificado

### O que fazer

Calcular X (já capado no grupo 3; reaplique após unique-phone). Calcular P/R. Y pela fórmula. Sample. Shuffle final. Passar essa lista ao `for` existente (sleep/imagem/débito intactos).

Se R>0, Y ≤ X-1. Se P=0, Y=0.

Log: `X`, `P`, `R`, `Y`.

### Critérios de aceite

- [ ] P=10, R=90, X=10 → 1 premium + 9 comuns
- [ ] P=0 → só comuns
- [ ] P grande e R>0 → lote não é 100% premium
- [ ] Ainda um `TenantLead` por send com `messageId`

### Não fazer

- Não ordenar o lote por rating (creme)
- Não mandar só top-N

---

## Verificação do grupo

- Logs de uma execução seca (comentar send se preciso) mostram X/P/R/Y
- Mesmo phone não aparece duas vezes em `leadsToContact`

## Handoff para próxima task

Admin (grupos 5–6) não depende deste mix. Verificação final (8) assume mix + dedup no notifly.
