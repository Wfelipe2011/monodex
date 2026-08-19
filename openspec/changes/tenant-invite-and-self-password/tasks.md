| Grupo | Arquivo de detalhes |
|-------|---------------------|
| 1 | [task-01-schema-e-migration.md](./tasks/task-01-schema-e-migration.md) |
| 2 | [task-02-shared-token-curto-e-ttl.md](./tasks/task-02-shared-token-curto-e-ttl.md) |
| 3 | [task-03-admin-emissao-listagem-e-revogacao.md](./tasks/task-03-admin-emissao-listagem-e-revogacao.md) |
| 4 | [task-04-publico-preview-e-aceite.md](./tasks/task-04-publico-preview-e-aceite.md) |
| 5 | [task-05-auth-troca-de-senha-propria.md](./tasks/task-05-auth-troca-de-senha-propria.md) |
| 6 | [task-06-postman-front-integration-e-verificacao.md](./tasks/task-06-postman-front-integration-e-verificacao.md) |

**Ordem de execução:** 1 → 2 → 3 → 4 → 6, com **5 em paralelo** a partir de 1 (não depende de convite).

Grupo 4 estende o `InvitesService` da 3. Grupo 6 espera emissão, aceite público e change-password.

**Artefatos de contexto:** [proposal.md](./proposal.md) · [design.md](./design.md) · specs

## 1. Schema e migration

📄 [Detalhes](./tasks/task-01-schema-e-migration.md)

- [x] 1.1 Adicionar enum `InvitePurpose` e model `Invite` (hash, expiry, consumo, revogação, tenant)
- [x] 1.2 Migration SQL e `npx prisma validate`

## 2. Shared — token curto e TTL

📄 [Detalhes](./tasks/task-02-shared-token-curto-e-ttl.md)

- [x] 2.1 Helpers `generateInviteToken`, `hashInviteToken` e `inviteExpiresAt` com testes

## 3. Admin — emissão, listagem e revogação

📄 [Detalhes](./tasks/task-03-admin-emissao-listagem-e-revogacao.md)

- [x] 3.1 `POST/GET/revoke` de `FIRST_ADMIN` em `/platform/tenants/:tenantId/invites`
- [x] 3.2 `POST/GET/revoke` de `TENANT_USER` em `/tenant/:tenantId/invites` (Super Admin 403 no write)
- [x] 3.3 Revogar `FIRST_ADMIN` pendentes quando o primeiro user nasce via create-com-senha
- [x] 3.4 Testes do service de convites (cardinalidade, 409 com user existente, omitir token na listagem)

## 4. Público — preview e aceite

📄 [Detalhes](./tasks/task-04-publico-preview-e-aceite.md)

- [x] 4.1 `GET /public/invites/:token` e `POST /public/invites/:token/accept` (`@Public()`, JWT no aceite)
- [x] 4.2 Rate limit in-memory; 404 genérico; transação consume+create; 409 unique não consome
- [x] 4.3 Testes de aceite (`FIRST_ADMIN` vs `TENANT_USER`, tenant já com user, token morto)

## 5. Auth — troca de senha própria

📄 [Detalhes](./tasks/task-05-auth-troca-de-senha-propria.md)

- [x] 5.1 `POST /auth/change-password` com senha atual; testes de sucesso e senha atual inválida

## 6. Postman, FRONT-INTEGRATION e verificação

📄 [Detalhes](./tasks/task-06-postman-front-integration-e-verificacao.md)

- [x] 6.1 Requests Postman (platform/tenant invites, public accept, change-password)
- [x] 6.2 `FRONT-INTEGRATION.md` (copiar link, `/convite/:token`, alterar senha, papéis USER vs ADMIN)
- [x] 6.3 Env Joi (`INVITE_TTL_HOURS`, `INVITE_PUBLIC_BASE_URL`) e checklist create-com-senha intacto
