# Task 4 — Admin — API de listagem

**Change:** `city-outreach-send-status`
**Grupo:** 4 de 5
**Pré-requisitos:** [task-01](./task-01-schema-e-migration.md)
**Desbloqueia:** [task-05](./task-05-postman-front-integration-e-verificacao.md)

## Objetivo do grupo

Front consegue listar envios de **cidade** (status, nome/telefone, template) por polling, em paths separados dos sends de lista.

## Contexto para o subagent

- Módulo: `apps/gym-ctrl/src/modules/admin/`. Registrar controllers/providers em `admin.module.ts`.
- Espelho de lista (NÃO reutilizar): `list-campaigns.controller.ts` `ListSendsController` + `list-campaigns.service.ts` `listSends` / `loadLatestFailedErrors`.
- Stats de cidade já usam dois prefixos: `ops.controller.ts` (`GET platform/tenants/:tenantId/leads/stats` SUPER_ADMIN; `GET tenant/:tenantId/leads/stats` ADMIN+SUPER_ADMIN + `TenantScopeGuard` + `TenantActiveGuard`).
- 404 tenant: `OpsService.leadsStats` — `tenant.findUnique` senão `NotFoundException`.
- DTO lista: `ListSendResponseDto` em `dto/swagger/tenant-list.swagger.dto.ts`. **Não** meter cidade nesse arquivo de listas — criar DTO próprio, ex. `dto/swagger/city-outreach-sends.swagger.dto.ts` (ou ao lado de `dto/`).
- `ADMIN_TENANT_ID_PARAM` pode ser importado do swagger de listas (é só o param tenantId).
- GET em tenant inativo deve passar (`TenantActiveGuard` libera leitura).
- `swagger-spec.json` na raiz é gerado no `gym:dev` via `generate-metadata.ts`; não é obrigatório commitar nesta task se o metadata plugin atualizar no dev — mas DTOs com `@ApiProperty` são a fonte.
- Sem WebSocket, sem POST.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/gym-ctrl/src/modules/admin/outreach-sends.service.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/outreach-sends.controller.ts` | criar (dois controllers no mesmo arquivo, padrão ops/lead-lists) |
| `apps/gym-ctrl/src/modules/admin/dto/swagger/city-outreach-sends.swagger.dto.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/outreach-sends.service.spec.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/admin.module.ts` | editar |

---

## 4.1 — GETs tenant e platform

### O que fazer

Service `OutreachSendsService.listSends(tenantId, query: { status?: string })`:

1. 404 se tenant não existe.
2. `tenantLead.findMany` where:
   - `tenantId`
   - `messageId: { not: null }` (exclui captura)
   - se `query.status === 'failed'` → `lastStatus: WhatsappDeliveryStatus.failed`
3. `orderBy: { createdAt: 'desc' }`, `take: 100`.
4. `select`: id, messageId, createdAt, lastStatus, templateName, `lead: { id, name, phone }`.
5. Para failed: copiar `loadLatestFailedErrors` de `ListCampaignsService` (query `whatsappSendStatus` por wamids + `status: failed`, `orderBy metaTimestamp desc`, primeiro por wamid).
6. Map:

```ts
{
  id: row.id,
  wamid: row.messageId,
  sentAt: row.createdAt,
  lastStatus: row.lastStatus,
  templateName: row.templateName,
  lead: row.lead,
  ...(failed ? { latestError: ... } : {}),
}
```

**Não** incluir `TenantListSend`. **Não** join em campanha/lista.

Controllers:

```ts
// Tenant — City Outreach Sends
@RolesAuth(Roles.ADMIN, Roles.SUPER_ADMIN)
@UseGuards(TenantScopeGuard, TenantActiveGuard)
@Controller('tenant/:tenantId/outreach/sends')
GET /

// Platform — City Outreach Sends
@RolesAuth(Roles.SUPER_ADMIN)
@Controller('platform/tenants/:tenantId/outreach/sends')
GET /
```

Query `status` opcional, enum `failed` no Swagger (igual `ListSendsController`). Outro valor de `status` → ignorar filtro (ou 400 se quiserem ser estritos; listas só tratam `=== 'failed'`).

Tags: `Tenant — Outreach` / `Platform — Outreach` **ou** tags novas `Tenant — City Outreach Sends` / `Platform — City Outreach Sends` para não misturar com config. Preferir tags novas para o Swagger não enterrar sends no meio de PATCH de config.

### Critérios de aceite

- [ ] Dois GETs registrados no `AdminModule`
- [ ] Payload tem status, `templateName`, `lead.name`, `lead.phone`, `wamid`
- [ ] `status=failed` filtra e inclui `latestError` quando houver evento failed
- [ ] Rows sem `messageId` ausentes
- [ ] Nenhum campo de `TenantListSend` / listLead / campaign

### Não fazer

- Não criar rota em `.../lead-lists/:listId/sends`
- Não realtime
- Não listar notify ao `Tenant.phone`

---

## 4.2 — Testes do service

### O que fazer

`outreach-sends.service.spec.ts` no estilo `outreach-config.service.spec.ts` (Prisma mockado).

Casos:

1. Tenant inexistente → `NotFoundException`.
2. Mix: um `TenantLead` com `messageId` + um sem → só o com wamid.
3. `status=failed` → só `lastStatus failed`; `latestError` vem do status mais recente.
4. Garantir que o service **não** chama `tenantListSend.findMany`.

Não precisa e2e de guard 403 nesta task (já coberto pelo padrão RolesAuth); se fácil, um comentário no controller basta.

### Critérios de aceite

- [ ] `npx jest apps/gym-ctrl/src/modules/admin/outreach-sends.service.spec.ts` passa
- [ ] Cobertura dos casos 1–3 acima

### Não fazer

- Não mockar Meta
- Não alterar `list-campaigns.service.ts` para “reusar” listSends com um flag (duplicar o pedaço de latestError é ok)

---

## Verificação do grupo

- Jest do spec
- Swagger local: paths visíveis nas tags novas
- Confirmar que `GET .../lead-lists/:listId/sends` permanece intocado

## Handoff para próxima task

Contrato HTTP pronto para Postman e FRONT-INTEGRATION. `templateName` null em histórico é válido.
