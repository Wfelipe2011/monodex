| Grupo | Arquivo de detalhes |
|-------|---------------------|
| 1 | [task-01-schema-e-migration.md](./tasks/task-01-schema-e-migration.md) |
| 2 | [task-02-guards-e-helpers-de-autorizacao.md](./tasks/task-02-guards-e-helpers-de-autorizacao.md) |
| 3 | [task-03-prefixo-platform-e-split-de-campos-super-admin.md](./tasks/task-03-prefixo-platform-e-split-de-campos-super-admin.md) |
| 4 | [task-04-superficie-tenant-operacional.md](./tasks/task-04-superficie-tenant-operacional.md) |
| 5 | [task-05-apis-de-send-policy-e-template-grants.md](./tasks/task-05-apis-de-send-policy-e-template-grants.md) |
| 6 | [task-06-pedidos-de-scrape-pelo-admin.md](./tasks/task-06-pedidos-de-scrape-pelo-admin.md) |
| 7 | [task-07-runtime-notifly.md](./tasks/task-07-runtime-notifly.md) |
| 8 | [task-08-postman-seeds-e-verificacao.md](./tasks/task-08-postman-seeds-e-verificacao.md) |

**Ordem de execução:** 1 → 2 → 3 → (4 ∥ 5) → 6 → 7 → 8

Grupo 7 pode começar após 1–2 (só runtime + schema/helpers); o E2E do 8 precisa de 3–6. Grupo 6 precisa de 4 (padrão `/tenant`) e 5 (policy).

**Artefatos de contexto:** [proposal.md](./proposal.md) · [design.md](./design.md) · specs

---

## 1. Schema e migration

📄 [Detalhes](./tasks/task-01-schema-e-migration.md)

- [x] 1.1 Adicionar models `TenantSendPolicy`, `TenantRespect`, `TenantTemplateGrant`, `TenantScrapeTarget` em `prisma/schema.prisma` com FKs e uniques do design
- [x] 1.2 Relacionar os models em `Tenant`, `WhatsappMessageTemplate` e `ScrapeTarget`
- [x] 1.3 Criar e aplicar migration Prisma
- [x] 1.4 Seed opcional: policy vazia (arrays vazios, flags false) para tenants existentes, sem criar grants nem scrape links

## 2. Guards e helpers de autorização

📄 [Detalhes](./tasks/task-02-guards-e-helpers-de-autorizacao.md)

- [x] 2.1 Constante `BOOTSTRAP_EDIT_WINDOW_MS = 30 * 60 * 1000` e helper `isWithinBootstrapWindow(createdAt)`
- [x] 2.2 `TenantScopeGuard` para `/tenant/:tenantId` (`ADMIN` só jwt.tenantId; `SUPER_ADMIN` passa)
- [x] 2.3 `TenantActiveGuard` bloqueando mutações `/tenant` quando `active=false` (GET liberado)
- [x] 2.4 Helper/serviço de pontapé: Super Admin create se recurso ausente; PATCH campos de Admin só dentro da janela; senão 403
- [x] 2.5 Testes unitários dos helpers de janela, XOR de cidade e união de telefones excluídos

## 3. Prefixo /platform e split de campos Super Admin

📄 [Detalhes](./tasks/task-03-prefixo-platform-e-split-de-campos-super-admin.md)

- [x] 3.1 Mover controllers de plataforma de `/admin` para `/platform` (tenants, coins write, WhatsApp accounts/templates/sync/test, scrape-targets globais, coverages, job schedules, ops summary, leads count, health)
- [x] 3.2 `POST /platform/tenants/:id/users` só quando o tenant ainda não tem user; GET users permitido; PATCH/reset/segundo user 403 para Super Admin
- [x] 3.3 Outreach platform: GET completo; PATCH só `costPerLead`/`cashbackOnReply`; PUT bootstrap se não existir; rejeitar knobs de Admin após janela
- [x] 3.4 `PATCH /platform/tenants/:tenantId/lead-lists/:listId` só `costPerSend` (≥ 0; negativo 400)
- [x] 3.5 `RolesAuth(SUPER_ADMIN)` em `/platform`; Admin de tenant recebe 403

## 4. Superfície /tenant operacional

📄 [Detalhes](./tasks/task-04-superficie-tenant-operacional.md)

- [x] 4.1 Controllers `/tenant/:tenantId` com scope + active + `@RolesAuth(ADMIN)` (Super Admin GET via D2)
- [x] 4.2 Outreach operacional: GET (inclui preço read-only); PATCH knobs/schedule/categories/enabled/bindings/template ids; PUT se ausente sem preço; 403 se body tiver `costPerLead`/`cashbackOnReply`
- [x] 4.3 Listas, leads, import, category-suggestions, campanhas, sends, inbox GET+POST reply, PATCH `Tenant.phone`, users CRUD após o primeiro, GET coins/extrato/stats
- [x] 4.4 Validar template ids contra grants; `enabled=true` continua exigindo phone, active, APPROVED e bindings
- [x] 4.5 Create lista `{ name }` com `costPerSend=0`; Admin não envia `costPerSend`
- [x] 4.6 Mover push para `/tenant/push-subscriptions`; bloquear PUT/DELETE se tenant inativo

## 5. APIs de send-policy e template grants

📄 [Detalhes](./tasks/task-05-apis-de-send-policy-e-template-grants.md)

- [x] 5.1 `GET/PUT /platform/tenants/:tenantId/send-policy` (cidades XOR, `respectAllTenants`, `exclusive`, edges `TenantRespect`)
- [x] 5.2 `GET /tenant/:tenantId/send-policy` read-only para Admin
- [x] 5.3 CRUD grants em `/platform/tenants/:tenantId/template-grants`
- [x] 5.4 `GET /tenant/:tenantId/whatsapp-templates` só granted, sem sync

## 6. Pedidos de scrape pelo Admin

📄 [Detalhes](./tasks/task-06-pedidos-de-scrape-pelo-admin.md)

- [x] 6.1 `POST /tenant/:tenantId/scrape-targets` resolve/cria City, checa política de cidade, upsert `ScrapeTarget`, cria `TenantScrapeTarget`
- [x] 6.2 Create do par novo com `enabled=true`; share de existente não altera `enabled`
- [x] 6.3 `GET` Admin só vínculos do tenant; Super Admin lista global permanece em `/platform/scrape-targets`

## 7. Runtime notifly

📄 [Detalhes](./tasks/task-07-runtime-notifly.md)

- [x] 7.1 Skip city outreach e list campaigns quando `Tenant.active=false`
- [x] 7.2 `contactLeads`: filtrar `cityId` por allow/deny; excluir phones `contacted=true` (grafo + respectAll + exclusive), qualquer cidade
- [x] 7.3 Não aplicar políticas de cidade/exclusividade no cron de lista; skip lista se `costPerSend <= 0`
- [x] 7.4 Testes unitários da união de exclusão e XOR de cidade (pure functions extraídas se preciso)

## 8. Postman, seeds e verificação

📄 [Detalhes](./tasks/task-08-postman-seeds-e-verificacao.md)

- [x] 8.1 Atualizar Postman: pastas Platform vs Tenant; login Super Admin e Admin; paths novos
- [x] 8.2 Documentar/ajustar seeds de outreach para grants + policy vazia
- [x] 8.3 Checklist E2E: 403 cruzado de papéis, janela de 30 min, tenant inativo só GET, scrape share, exclusividade retroativa por telefone
