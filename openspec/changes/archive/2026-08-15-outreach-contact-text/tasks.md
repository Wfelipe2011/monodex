| Grupo | Arquivo de detalhes |
|-------|---------------------|
| 1 | [task-01-schema-e-migration.md](./tasks/task-01-schema-e-migration.md) |
| 2 | [task-02-admin-outreach-contact-text.md](./tasks/task-02-admin-outreach-contact-text.md) |
| 3 | [task-03-notifly-parametro-body-do-template.md](./tasks/task-03-notifly-parametro-body-do-template.md) |
| 4 | [task-04-postman-seed-e-verificacao.md](./tasks/task-04-postman-seed-e-verificacao.md) |

**Ordem de execução:** 1 → (2 ∥ 3) → 4

**Artefatos de contexto:** [proposal.md](./proposal.md) · [design.md](./design.md) · specs

## 1. Schema e migration

📄 [Detalhes](./tasks/task-01-schema-e-migration.md)

- [x] 1.1 Adicionar `outreachContactText` em `TenantOutreachConfig` (`String`, map `outreach_contact_text`)
- [x] 1.2 Migration: coluna NOT NULL DEFAULT `''` nas rows existentes; gerar client Prisma

## 2. Admin — outreachContactText

📄 [Detalhes](./tasks/task-02-admin-outreach-contact-text.md)

- [x] 2.1 PUT/PATCH DTOs: campo com MinLength 1, MaxLength 80; rejeitar newline/tab; PUT required
- [x] 2.2 Persistência e `assertEnableAllowed` exigindo texto trimado não vazio; GET devolve o campo

## 3. Notifly — parâmetro body do template

📄 [Detalhes](./tasks/task-03-notifly-parametro-body-do-template.md)

- [x] 3.1 Em `contactLeads`, enviar componente body positional com `outreachContactText`
- [x] 3.2 Não POST na Graph API quando o texto estiver vazio; log warn

## 4. Postman, seed e verificação

📄 [Detalhes](./tasks/task-04-postman-seed-e-verificacao.md)

- [x] 4.1 Seed: setar texto no create; não sobrescrever no update
- [x] 4.2 Atualizar bodies PUT/PATCH no Postman
- [x] 4.3 `npx prisma validate`; grep do campo no admin e no notifly
