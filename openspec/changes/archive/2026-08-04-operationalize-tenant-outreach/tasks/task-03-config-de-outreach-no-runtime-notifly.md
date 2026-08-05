# Task 3 — Config de outreach no runtime notifly

**Change:** `operationalize-tenant-outreach`
**Grupo:** 3 de 5
**Pré-requisitos:** [1](./task-01-schema-e-migration.md), [2](./task-02-conta-cloud-api-da-plataforma.md)
**Desbloqueia:** [5](./task-05-verificacao-e-handoff.md)

## Objetivo do grupo

Fazer o cron/`contactLeads`/`responseLeads` do notifly operarem multi-tenant via `TenantOutreachConfig`, sem `tenant.id: 8` hardcoded, preservando correlação wamid.

## Contexto para o subagent

Arquivo principal: `apps/notifly/src/leads.service.ts`

Comportamentos atuais a preservar (exceto hardcodes/pricing/templates/schedule/categories):

- Cron `@Cron('0 13,18 * * 2-4')` + filtro interno de dia/hora.
- Em `contactLeads`: busca leads **não** presentes em `tenantLead` daquele tenant; filtros de phone (`not contains 153`) e website OR (facebo/instagra/etc.); shuffle; slice 20.
- Cria `TenantLead` com `messageId: res.data.messages[0].id`.
- Debita coin do `user.findFirst({ tenantId })` (manter esse critério; documentar em log se útil).
- `responseLeads`: acha por `messageId: body.context?.id`; marca replied; se botão Sim, template para `tenant.phone`; cashback.

Specs: `specs/cloud-outreach-runtime/spec.md`, `specs/tenant-outreach-config/spec.md`.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/notifly/src/leads.service.ts` | editar |
| helpers de schedule/config (opcional no mesmo arquivo ou util local) | criar/editar |

---

## 3.1 — Seleção de tenants elegíveis

### O que fazer

Substituir:

```ts
const tentants = await this.prisma.tenant.findMany({
  where: { id: 8 },
});
```

por query que inclua tenants com:

- `outreachConfig.enabled === true`
- `phone` not null / not empty
- include da config (e opcionalmente coins)

Skip com warn se saldo `< costPerLead` (ou `< 1` legado — preferir comparar com `costPerLead` da config).

### Critérios de aceite

- [ ] Nenhum `id: 8` (ou outro id fixo) na seleção de outreach
- [ ] Tenant disabled ou sem phone não é processado
- [ ] Dois tenants enabled+phone+saldo seriam ambos iterados

### Não fazer

- Não reativar Baileys/captura
- Não mudar `deleteOldLeads` além do necessário (pode continuar global)

---

## 3.2 — Aplicar campos da config

### O que fazer

Para cada tenant elegível:

1. **Schedule:** usar `outreachConfig.schedule` (Json) no lugar do objeto literal `schedule = { 2:[18], ... }`. Se o cron decorator ainda for amplo, o filtro fino **por tenant** decide se aquele tenant roda “agora”.
2. **Categories:** `lead.category in config.categories`.
3. **Template outreach:** `amigavel` → `config.outreachTemplateName`.
4. **Debit:** `0.35` → `config.costPerLead` (balance decrement + transaction amount negativo).
5. **Notify template:** `lembrete_entrar_contato_cliente` → `config.notifyTenantTemplateName`.
6. **Cashback:** `0.00` → `config.cashbackOnReply`.

Manter filtros de website/phone hardcoded **por enquanto** (design não migrou isso para config nesta change), a menos que já estejam triviais de externalizar junto — preferir mínimo necessário.

### Critérios de aceite

- [ ] Literais de pricing/templates do fluxo principal vêm da config
- [ ] Categories do findMany vêm da config
- [ ] Schedule por tenant respeitado

### Não fazer

- Não exigir UI admin
- Não alterar copy/body parameters do template Meta sem necessidade (manter `nome`/`empresa`/`descricao` atuais)

---

## 3.3 — Preservar messageId / webhook correlation

### O que fazer

Garantir que:

- Após send OK, `TenantLead.messageId` = wamid retornado.
- `responseLeads` continua matching `body.context?.id`.
- Não criar relation Prisma `Message`.

### Critérios de aceite

- [ ] Create/update paths de `messageId` intactos semanticamente
- [ ] Nenhum `messageId Int @relation` introduzido

### Não fazer

- Não “corrigir” typo `WhatsapContact` nesta task

---

## Verificação do grupo

- Com dois tenants enabled em DB de dev (mesmo que saldo baixe), logs do cron devem listar ambos quando schedule casa.
- Send de teste grava `messageId`; simular webhook com `context.id` atualiza `replied`.

## Handoff para próxima task

Runtime Cloud multi-tenant operacional. Task 4 (welcome) é independente e pode rodar em paralelo após schema; Task 5 fecha checklist E2E.
