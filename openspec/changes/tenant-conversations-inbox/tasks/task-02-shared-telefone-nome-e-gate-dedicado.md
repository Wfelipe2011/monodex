# Task 2 — Shared — telefone, nome e gate dedicado

**Change:** `tenant-conversations-inbox`
**Grupo:** 2 de 7
**Pré-requisitos:** nenhum (schema da task 1 pode estar em paralelo; este grupo é puro TypeScript)
**Desbloqueia:** [task-03](./task-03-notifly-thread-no-webhook-e-nos-templates.md), [task-04](./task-04-admin-api-de-conversas.md), [task-06](./task-06-admin-test-send-e-home-do-tenant.md)

## Objetivo do grupo

Funções puras para `displayName` de inbound e para decidir se uma conta WhatsApp da plataforma é dedicada (não-default). Lookup de `TenantOutreachConfig` permanece nos apps.

## Contexto para o subagent

- `libs/shared/` — imports `@core/shared/<file>` (ver `tsconfig.json` paths). **Não** há `index.ts` barrel; cada arquivo é importado pelo path.
- Telefone: reutilizar `normalizeListPhone` de `libs/shared/list-campaign-helpers.ts` (dígitos, prefixo `55`).
- Contatos do webhook: `apps/notifly/src/interfaces.ts` → `Contact` `{ profile: { name: string }, wa_id: string }`. O helper pode tipar um shape mínimo, não precisa importar notifly.
- Testes no estilo `libs/shared/whatsapp-template.spec.ts` / `send-policy.spec.ts` (Jest, colocalizados).
- Não usar Prisma neste grupo.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `libs/shared/whatsapp-conversation.ts` | criar |
| `libs/shared/whatsapp-conversation.spec.ts` | criar |

---

## 2.1 — Helpers de nome e conta dedicada

### O que fazer

Exportar pelo menos:

```ts
export function isDedicatedPlatformAccount(account: {
  isDefault: boolean;
}): boolean;
// true somente se isDefault === false

export function matchContactProfileName(
  contacts: Array<{ wa_id?: string; profile?: { name?: string } }> | undefined,
  fromPhone: string,
): string | null;
// normaliza wa_id e from com normalizeListPhone; retorna profile.name trimado ou null

export function resolveConversationDisplayName(input: {
  profileName: string | null;
  phone: string;
  existingDisplayName?: string | null;
  isNewThread: boolean;
}): string;
```

Regras de `resolveConversationDisplayName` (design D5):

- Se `profileName` não vazio → usar esse valor (também sobrescreve thread existente).
- Senão se `isNewThread` → `phone` já normalizado.
- Senão → `existingDisplayName` se não vazio, senão `phone`.

### Critérios de aceite

- [ ] `isDedicatedPlatformAccount({ isDefault: true })` é false
- [ ] Match de contato ignora formatação (`5511999` vs `+55 11 999`)
- [ ] Thread nova sem nome usa o phone; inbound seguinte com nome atualiza
- [ ] Testes Jest cobrindo os três casos de displayName

### Não fazer

- Não consultar banco
- Não alterar `normalizeListPhone`
- Não colocar upsert Prisma neste arquivo

---

## Verificação do grupo

Rodar os testes do spec novo (comando Jest do monorepo que já cobre `libs/shared`).

## Handoff para próxima task

Notifly e gym-ctrl importam `@core/shared/whatsapp-conversation` para nome e gate `isDefault`.
