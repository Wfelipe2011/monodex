| Grupo | Arquivo de detalhes |
|-------|---------------------|
| 1 | [task-01-schema-e-migration.md](./tasks/task-01-schema-e-migration.md) |
| 2 | [task-02-conta-cloud-api-da-plataforma.md](./tasks/task-02-conta-cloud-api-da-plataforma.md) |
| 3 | [task-03-config-de-outreach-no-runtime-notifly.md](./tasks/task-03-config-de-outreach-no-runtime-notifly.md) |
| 4 | [task-04-welcome-redirect-por-tenant.md](./tasks/task-04-welcome-redirect-por-tenant.md) |
| 5 | [task-05-verificacao-e-handoff.md](./tasks/task-05-verificacao-e-handoff.md) |

**Ordem de execução:** 1 → 2 → 3 → 5; grupo 4 pode rodar em paralelo com 2/3 após o grupo 1.

**Artefatos de contexto:** [proposal.md](./proposal.md) · [design.md](./design.md) · specs

## 1. Schema e migration

📄 [Detalhes](./tasks/task-01-schema-e-migration.md)

- [x] 1.1 Adicionar models `TenantOutreachConfig` e `WhatsappAccount` (provider CLOUD_API) + relations em `Tenant` no `prisma/schema.prisma`
- [x] 1.2 Criar migration Prisma e gerar client
- [x] 1.3 Script/data seed: conta plataforma com phoneNumberId atual; config enabled para o tenant operacional (ex-id 8) com pricing/templates/schedule/categories atuais

## 2. Conta Cloud API da plataforma

📄 [Detalhes](./tasks/task-02-conta-cloud-api-da-plataforma.md)

- [x] 2.1 Criar serviço/resolvers em notifly para carregar conta plataforma enabled + token via env key
- [x] 2.2 Substituir URL hardcoded `688645744332614` em `leads.service.ts` pelo phoneNumberId resolvido
- [x] 2.3 Garantir que token continua apenas em `process.env` (nunca persistido)

## 3. Config de outreach no runtime notifly

📄 [Detalhes](./tasks/task-03-config-de-outreach-no-runtime-notifly.md)

- [x] 3.1 Remover filtro hardcoded `tenant.id: 8`; selecionar tenants com config enabled + phone + saldo
- [x] 3.2 Aplicar `schedule`, `categories`, `costPerLead`, templates e `cashbackOnReply` a partir de `TenantOutreachConfig`
- [x] 3.3 Preservar gravação/correlação de `TenantLead.messageId` (wamid) no envio e no webhook

## 4. Welcome redirect por Tenant

📄 [Detalhes](./tasks/task-04-welcome-redirect-por-tenant.md)

- [x] 4.1 Injetar Prisma em `WhatsappController` e resolver `Tenant` por uuid (sanitizar `{{1}}`)
- [x] 4.2 Redirect `wa.me` com `Tenant.phone`; fallback `public/index.html` se uuid/phone inválidos
- [x] 4.3 Remover mapa em memória `tenats`

## 5. Verificação e handoff

📄 [Detalhes](./tasks/task-05-verificacao-e-handoff.md)

- [x] 5.1 Checklist manual: welcome UUID, cron com 2 tenants elegíveis (ou mock), reply SIM notifica tenant.phone
- [x] 5.2 Documentar no change/README curto: Baileys/captura outbound fora de escopo; Cloud API é o caminho oficial
