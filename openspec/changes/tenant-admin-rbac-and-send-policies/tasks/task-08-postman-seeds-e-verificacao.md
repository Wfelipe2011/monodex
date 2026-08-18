# Task 8 — Postman, seeds e verificação

**Change:** `tenant-admin-rbac-and-send-policies`
**Grupo:** 8 de 8
**Pré-requisitos:** grupos 3–7
**Desbloqueia:** archive / apply completo

## Objetivo do grupo

Collection e seeds alinhados aos prefixos; checklist E2E dos papéis, janela, lock, scrape share e exclusividade.

## Contexto para o subagent

- Collection: `postman/monodex.postman_collection.json` — pastas `Admin — *` com paths `/admin/...`.
- Seeds: `prisma/seed-outreach.ts` (config tenant operacional, templates stub); `prisma/seed-platform-admin.ts`.
- Após grants: seed deve **grantar** os templates stub ao tenant operacional (id 8 / `TENANT_ID`) senão Admin não aponta ids.
- Auth: `POST /auth/login` inalterado.
- Deep link push já atualizado no grupo 4; se existir `openspec/changes/inbox-web-push/PUSH-INTEGRATION.md` ou spec front, atualizar path `/tenant/...` se ainda no repo ativo — senão só Postman.
- Specs de verificação: todas as capabilities desta change.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `postman/monodex.postman_collection.json` | editar |
| `prisma/seed-outreach.ts` | editar (policy + grants) |
| docs de integração inbox se ainda citarem `/admin/tenants` | editar se existirem no tree ativo |

---

## 8.1 — Postman Platform vs Tenant

### O que fazer

Renomear pastas:

- `Platform — *` : health, ops, tenants, primeiro user, coins credit/debit, WhatsApp, scrape global, coverage, jobs, send-policy, grants, patch `costPerLead` / `costPerSend`.
- `Tenant — *` : outreach knobs, listas, campanhas, inbox, users, scrape requests, GET coins, GET policy, GET templates granted, push.

Dois logins: `SUPER_ADMIN` (seed platform) e `ADMIN` do tenant. Variáveis `platformToken` / `tenantToken` / `tenantId`.

Remover requests `/admin/` obsoletos.

### Critérios de aceite

- [ ] Nenhum path `/admin/` restante na collection (exceto se documentado como removido)
- [ ] Happy path Super Admin e Admin separados

### Não fazer

- Não commitar `.env` / tokens reais

---

## 8.2 — Seeds grants + policy

### O que fazer

`seed-outreach.ts`: upsert `TenantSendPolicy` vazia; upsert `TenantTemplateGrant` para os templates stub (`test_gladson`, notify) do tenant alvo. Idempotente.

### Critérios de aceite

- [ ] Re-run seed não duplica grant (unique)
- [ ] Tenant seed tem policy row

### Não fazer

- Não apagar `WhatsappAccount` da plataforma

---

## 8.3 — Checklist E2E

### O que fazer

Executar (Swagger ou Postman) e marcar:

1. ADMIN `GET /platform/tenants` → 403; SUPER_ADMIN → 200.
2. ADMIN `GET /tenant/{outroId}/...` → 403.
3. SUPER_ADMIN PATCH `leadsPerRun` em config antiga (>30 min) → 403; PATCH `costPerLead` → 200.
4. SUPER_ADMIN PUT outreach quando já existe → 403.
5. Tenant `active=false`: Admin GET outreach 200; POST lista 403; cron não envia (log ou ausência de `TenantLead` novo).
6. Dois tenants POST mesmo scrape pair → um `scrape_targets`, dois links; Admin GET só o próprio.
7. Allowlist: Admin scrape cidade fora → 400.
8. Grant ausente: Admin PATCH `outreachTemplateId` → 400; após grant → 200.
9. Policy X respeita Y: Y com `TenantLead.contacted=true` no phone P; seleção de X não inclui P (unit 7.4 + inspeção se possível).
10. ADMIN PATCH `costPerSend` → 403; SUPER_ADMIN PATCH → 200; GET Admin mostra valor.

### Critérios de aceite

- [ ] Itens 1–8 e 10 comprovados (HTTP)
- [ ] Item 9 coberto por teste unitário do grupo 7 se E2E Graph inviável

### Não fazer

- Não exigir envio Meta real para fechar o grupo

---

## Verificação do grupo

Collection + seed + checklist acima. Change pronta para `/opsx-manager-apply` residual ou archive após código.

## Handoff para próxima task

Nenhuma. Documentar no NOTES se a janela de 30 min não puder ser testada sem manipular `createdAt` (SQL `UPDATE created_at`).
