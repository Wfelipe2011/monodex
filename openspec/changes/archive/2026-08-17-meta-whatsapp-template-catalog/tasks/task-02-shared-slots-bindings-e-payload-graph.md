# Task 2 — Shared — slots, bindings e payload Graph

**Change:** `meta-whatsapp-template-catalog`
**Grupo:** 2 de 8
**Pré-requisitos:** [task-01](./task-01-schema-e-migration.md) (types opcionais; helpers devem ser puros)
**Desbloqueia:** 4, 5, 6

## Objetivo do grupo

Funções puras em `@core/shared` para parsear templates Meta, resolver bindings e montar `components` do POST `/messages`.

## Contexto para o subagent

- Path alias já existe: `@core/shared` → `libs/shared`
- Hoje só há `libs/shared/uuid.shared.ts`
- Graph version usada no notifly: `v23.0` em `apps/notifly/src/platform-whatsapp.service.ts`
- Outreach atual (referência de payload, **não copiar para o send path**): `apps/notifly/src/leads.service.ts` ~264–313 (header image + body positional) e ~464–510 (named + button URL)
- Sem dependência Nest/Prisma nestes helpers

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `libs/shared/whatsapp-template-slots.ts` | criar |
| `libs/shared/whatsapp-template-bindings.ts` | criar |
| `libs/shared/whatsapp-template-payload.ts` | criar |

Nomes podem variar se exportarem a mesma API; manter um módulo importável.

---

## 2.1 — Parser de slots

### O que fazer

`parseTemplateSlots(components: unknown): TemplateSlot[]`

Regras de `key`:

- HEADER tipo IMAGE → `header.image` (`paramType: 'image'`)
- HEADER tipo TEXT com `{{n}}` ou named → `header.N` / `header.<name>`
- BODY positional `{{1}}`… → `body.1`, `body.2`, …
- BODY named → `body.<parameter_name>`
- BUTTON `sub_type` URL com variável → `button.<index>.url`

Ignorar FOOTER sem params. `format`: `positional` | `named`.

Cobrir os dois shapes reais: POSITIONAL com header IMAGE; NAMED body + URL button.

### Critérios de aceite

- [ ] Fixture POSITIONAL (header image + `{{1}}`) produz `header.image` e `body.1`
- [ ] Fixture NAMED (`customer_name` + button URL index 0) produz `body.customer_name` e `button.0.url`

### Não fazer

- Não chamar HTTP
- Não persistir

---

## 2.2 — Resolver de bindings

### O que fazer

Tipos fechados: `literal`, `header_image`, `lead.name`, `lead.phone`, `lead.city`, `lead.category`, `lead.rating`, `tenant.phone`, `now.date`, `now.datetime`.

`resolveBindingValue(binding, ctx): string`

- `literal` / `header_image`: `binding.value` trimado
- `lead.phone` / `tenant.phone`: só dígitos; prefixar `55` se não começar com `55`
- `lead.city`: `ctx.lead.cityName`
- `lead.category`: `ctx.lead.category`
- `lead.rating`: `null` → `—`; senão `toLocaleString('pt-BR')` (vírgula)
- `now.date`: `America/Sao_Paulo` → `dd/MM/yyyy`
- `now.datetime`: mesmo tz → `dd/MM/yyyy HH:mm`
- `lead.*` vazio/null → `—`

`ctx.now` injetável para testes.

### Critérios de aceite

- [ ] rating null → `—`
- [ ] phone `11999` → `5511999…` (prefixo 55)
- [ ] `now.date` com clock fixo em SP formata `dd/MM/yyyy`

### Não fazer

- Não aceitar types fora do enum (throw)

---

## 2.3 — Builder Graph

### O que fazer

`buildTemplateComponents(slots, values: Record<string, string>): object[]`

Agrupar por componente Graph:

- header image: `{ type: 'header', parameters: [{ type: 'image', image: { link } }] }`
- body positional: parâmetros `text` **sem** `parameter_name`, ordem pelo index
- body named: cada param `{ type: 'text', parameter_name, text }`
- button URL: `{ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text }] }`

Assinatura extra: `buildTemplateSendBody({ name, language, slots, values })` → `{ messaging_product, type: 'template', template: { name, language: { code }, components } }` (sem `to`).

### Critérios de aceite

- [ ] POSITIONAL não inclui `parameter_name`
- [ ] NAMED inclui `parameter_name`
- [ ] Botão URL usa `sub_type: 'url'` e `index` string

### Não fazer

- Não hardcodar `pt_BR` dentro do builder (language é argumento)

---

## Verificação do grupo

Importar os helpers de um arquivo de teste manual ou asserts em comentário + funções exportadas. Se o repo não tiver harness de unit test para libs, exportar funções e validar com um `node -e` / ts-node curto **não commitado**, ou testes se já houver padrão.

## Handoff para próxima task

Admin e notifly importam `@core/shared/...`. Não duplicar parser.
