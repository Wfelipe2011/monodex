# Task 2 — Shared — token curto e TTL

**Change:** `tenant-invite-and-self-password`
**Grupo:** 2 de 6
**Pré-requisitos:** [task-01](./task-01-schema-e-migration.md)
**Desbloqueia:** [task-03](./task-03-admin-emissao-listagem-e-revogacao.md), [task-04](./task-04-publico-preview-e-aceite.md)

## Objetivo do grupo

Helpers puros (sem Nest/Prisma) para token de 8 caracteres, SHA-256 e `expiresAt`. Testes unitários.

## Contexto para o subagent

- Shared lib: `libs/shared/`. Import nos apps: `@core/shared/invite-token`.
- Espelho de estilo: `libs/shared/bootstrap-window.ts` + `libs/shared/bootstrap-window.spec.ts`.
- Jest: `package.json` já mapeia `^@core/shared(|/.*)$` → `libs/shared$1`.
- Node `crypto` (já no runtime). **Não** adicionar `nanoid` nem outra dep.
- Não alterar gym-ctrl nesta task.

Alfabeto Crockford sem ambiguidade: `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (32 símbolos). Comprimento **8**.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `libs/shared/invite-token.ts` | criar |
| `libs/shared/invite-token.spec.ts` | criar |

---

## 2.1 — Helpers e testes

### O que fazer

Exportar:

```ts
export const INVITE_TOKEN_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const INVITE_TOKEN_LENGTH = 8;
export const DEFAULT_INVITE_TTL_HOURS = 8;

export function generateInviteToken(): string
export function hashInviteToken(raw: string): string
export function inviteExpiresAt(now: Date, ttlHours: number): Date
```

Regras:

- `generateInviteToken`: 8 chars do alfabeto, via `crypto.randomInt` (ou `randomBytes` mapeado). Sem `Math.random`.
- `hashInviteToken`: `createHash('sha256').update(raw, 'utf8').digest('hex')`. Lookup no banco é por este hex.
- `inviteExpiresAt`: `now + ttlHours * 3600_000` ms. Rejeitar `ttlHours <= 0` com throw simples (`RangeError` ou equivalente).
- Não logar o raw token.

Testes:

- comprimento 8 e charset só do alfabeto (gerar N tokens)
- `hashInviteToken` determinístico; hashes de tokens distintos diferem
- `inviteExpiresAt` avança exatamente `ttlHours` horas
- `ttlHours` inválido lança

Comando: `npx jest libs/shared/invite-token.spec.ts`

### Critérios de aceite

- [ ] Token gerado tem length 8 e só caracteres do alfabeto
- [ ] Hash é SHA-256 hex (64 chars)
- [ ] TTL default documentado como 8h (const)
- [ ] Jest do spec passa
- [ ] Nenhuma dependência nova em `package.json`

### Não fazer

- Não persistir token (isso é Prisma na task 3)
- Não criar serviço Nest aqui
- Não usar UUID

---

## Verificação do grupo

```bash
npx jest libs/shared/invite-token.spec.ts
```

## Handoff para próxima task

Emissão (task 3) chama `generateInviteToken` + `hashInviteToken` + `inviteExpiresAt`. Aceite público (task 4) hasheia o `:token` da URL e busca por `tokenHash`.
