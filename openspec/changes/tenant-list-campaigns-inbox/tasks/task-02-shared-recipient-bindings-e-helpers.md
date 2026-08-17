# Task 2 — Shared — recipient bindings e helpers

**Change:** `tenant-list-campaigns-inbox`
**Grupo:** 2 de 8
**Pré-requisitos:** [task-01](./task-01-schema-e-migration.md)
**Desbloqueia:** [task-04](./task-04-admin-campanhas.md), [task-06](./task-06-notifly-cron-campanhas-e-reply-actions.md)

## Objetivo do grupo

Estender resolução de bindings para leads de lista e utilitários de telefone, categoria e botões QUICK_REPLY.

## Contexto para o subagent

- Bindings atuais: `libs/shared/whatsapp-template-bindings.ts`
- Testes: `libs/shared/whatsapp-template.spec.ts`
- `normalizeBrazilPhoneDigits` já existe — reutilizar para persistência e Graph `to`
- Parser de slots: `libs/shared/whatsapp-template-slots.ts` — **não** parseia QUICK_REPLY labels; novo helper separado

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `libs/shared/whatsapp-template-bindings.ts` | editar |
| `libs/shared/whatsapp-template.spec.ts` | editar |
| `libs/shared/list-campaign-helpers.ts` (ou nome similar) | criar |

---

## 2.1 — recipient.* bindings

### O que fazer

1. Adicionar a `BINDING_TYPES`:
   - `recipient.name`, `recipient.phone`, `recipient.category`, `recipient.website`, `recipient.reviews`

2. Estender `BindingResolveContext`:

```typescript
export type BindingRecipientContext = {
  name?: string | null;
  phone?: string | null;
  category?: string | null;
  website?: string | null;
  reviews?: number | null;
};

export type BindingResolveContext = {
  lead?: BindingLeadContext | null;
  recipient?: BindingRecipientContext | null;
  tenant?: { phone?: string | null } | null;
  now?: Date;
};
```

3. Em `resolveBindingValue`, mapear `recipient.*` com `emptyToDash` para campos vazios; `recipient.phone` usa `normalizeBrazilPhoneDigits`; `recipient.reviews` como string decimal ou inteiro legível.

4. Testes unitários para name, phone, category ausente → `—`.

### Critérios de aceite

- [ ] Tipos desconhecidos continuam rejeitados em validação admin (task 4)
- [ ] Testes passam: `npm test -- whatsapp-template.spec`

### Não fazer

- Alterar comportamento de `lead.*` existente

---

## 2.2 — Helpers telefone, categoria, QUICK_REPLY

### O que fazer

Criar `libs/shared/list-campaign-helpers.ts`:

**`normalizeListPhone(raw: string): string`**
- Dígitos only; prefixo `55` se ausente; usar em unique constraint e Graph.

**`normalizeCategoryKey(raw: string): string`**
- lower case, NFD remove acentos — para sugestões/dedup display, **não** substituir valor armazenado.

**`extractQuickReplyButtons(components: unknown): { index: number; label: string }[]`**
- Percorrer `components` tipo `BUTTONS`; botões `QUICK_REPLY` com `text` label.
- Referência: estrutura Meta em rows de catálogo (`WhatsappMessageTemplate.components`).

**`isWithinSchedule(schedule, day, hour)`**
- Extrair de `apps/notifly/src/leads.service.ts` para shared **ou** duplicar mínimo — preferir extrair para `@core/shared` e fazer leads.service importar (opcional nesta task; duplicar OK se escopo apertado).

### Critérios de aceite

- [ ] `extractQuickReplyButtons` retorna labels de template real do seed/catálogo
- [ ] Funções exportadas e usáveis por gym-ctrl e notifly

### Não fazer

- Parser de slots Meta (já existe)

---

## Verificação do grupo

```bash
npm test -- whatsapp-template.spec
```

## Handoff

Admin campanhas valida `buttonActions` contra output de `extractQuickReplyButtons`. Cron usa `recipient` context no resolve.
