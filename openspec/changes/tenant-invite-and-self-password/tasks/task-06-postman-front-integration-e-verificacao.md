# Task 6 — Postman, FRONT-INTEGRATION e verificação

**Change:** `tenant-invite-and-self-password`
**Grupo:** 6 de 6
**Pré-requisitos:** [task-03](./task-03-admin-emissao-listagem-e-revogacao.md), [task-04](./task-04-publico-preview-e-aceite.md), [task-05](./task-05-auth-troca-de-senha-propria.md)
**Desbloqueia:** nenhum

## Objetivo do grupo

Contrato usável pelo PWA (Postman + handoff), env Joi, e prova de que create-com-senha e reset de colega continuam.

## Contexto para o subagent

- Collection: `postman/monodex.postman_collection.json`.
- Folder **Platform — First User** (~linha 360, auth `{{platformToken}}`): manter `Create First User` com senha.
- Folder **Tenant — Users** (~linha 1767, auth `{{tenantToken}}`): manter create adicional e `Reset Password` de colega.
- Login já existe na collection (`POST /auth/login`).
- Handoff: criar `openspec/changes/tenant-invite-and-self-password/FRONT-INTEGRATION.md` no tom de `openspec/changes/city-outreach-send-status/FRONT-INTEGRATION.md` (português, paths, JSON, checklist). Front não vive neste repo.
- Joi: `apps/gym-ctrl/src/gym.module.ts` `ConfigModule.forRoot.validationSchema`. Vars novas **opcionais** com default (dev local não quebra se `.env` não tiver).
- `npx prisma validate` na raiz.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `postman/monodex.postman_collection.json` | editar |
| `openspec/changes/tenant-invite-and-self-password/FRONT-INTEGRATION.md` | criar |
| `apps/gym-ctrl/src/gym.module.ts` | editar (Joi) |

---

## 6.1 — Postman

### O que fazer

Adicionar folder **Platform — Invites** (auth `{{platformToken}}`):

- `POST {{gymBaseUrl}}/platform/tenants/{{tenantId}}/invites` (body `{}`)
- `GET {{gymBaseUrl}}/platform/tenants/{{tenantId}}/invites`
- `POST {{gymBaseUrl}}/platform/tenants/{{tenantId}}/invites/{{inviteId}}/revoke`

No POST create, script de teste: se 201, salvar `inviteToken` e `inviteId` em collection variables.

Folder **Tenant — Invites** (auth `{{tenantToken}}`):

- `POST {{gymBaseUrl}}/tenant/{{tenantId}}/invites`
- `GET {{gymBaseUrl}}/tenant/{{tenantId}}/invites`
- `POST .../invites/{{inviteId}}/revoke`

Folder **Public — Invites** (**sem** bearer no folder):

- `GET {{gymBaseUrl}}/public/invites/{{inviteToken}}`
- `POST {{gymBaseUrl}}/public/invites/{{inviteToken}}/accept` body name/username/email/password

Em **Autenticação** (ou folder Auth existente):

- `POST {{gymBaseUrl}}/auth/change-password` com bearer (`tenantToken` ou o token de quem está logado) body `{ currentPassword, newPassword }`

Não apagar Create First User nem Reset Password de colega.

### Critérios de aceite

- [ ] Requests novas nos folders certos
- [ ] Public folder sem `platformToken`
- [ ] Create-com-senha e reset de colega ainda na collection

### Não fazer

- Não criar collection nova
- Não documentar mailer

---

## 6.2 — FRONT-INTEGRATION.md

### O que fazer

Arquivo na pasta da change, cobrindo:

- **Breaking:** não (additive). Create-com-senha permanece.
- Super Admin: após criar tenant, botão “copiar convite” (`POST` platform invites → copiar `url`). Não pedir nome/e-mail/senha do Admin.
- Admin: “convidar USER” — mesmo padrão no prefixo tenant.
- Página pública `/convite/:token`: `GET` preview (nome da academia + purpose); form nome, username, e-mail, senha; `POST` accept; guardar JWT e entrar logado. 404 → “link inválido ou expirado” (TTL horas).
- `FIRST_ADMIN` → painel Admin. `TENANT_USER` → role `USER` **não** opera `/tenant/*` hoje (`RolesAuth` é ADMIN); UI não deve mandar USER para o painel operador — tela simples / “conta criada” / login. Ser explícito nisso.
- Alterar senha: logado, `POST /auth/change-password`. Super Admin não participa.
- Fora: esqueci-senha deslogado.
- Claim aberto: tratar `url` como segredo (WhatsApp direto com a pessoa).
- Env front: origin de `INVITE_PUBLIC_BASE_URL` deve ser o PWA, não o gym-ctrl.

JSON de emissão:

```json
{
  "id": 1,
  "purpose": "FIRST_ADMIN",
  "token": "A2B3C4D5",
  "url": "https://app.example.com/convite/A2B3C4D5",
  "expiresAt": "2026-08-19T23:00:00.000Z"
}
```

JSON de accept: `{ "token": "<jwt>" }` igual login.

### Critérios de aceite

- [ ] Arquivo existe nesta change
- [ ] Paths, papéis, TTL, e limitação USER vs painel documentados
- [ ] Create-com-senha citado como escape

### Não fazer

- Não implementar o PWA neste repo
- Não prometer e-mail transacional

---

## 6.3 — Joi e checklist

### O que fazer

Em `gym.module.ts`:

```ts
INVITE_TTL_HOURS: Joi.number().integer().min(1).max(48).default(8),
INVITE_PUBLIC_BASE_URL: Joi.string().optional(),
```

Não marcar como `required` (dev local sobe sem elas).

Checklist de verificação (no FRONT-INTEGRATION ou no próprio tasks não — só no FRONT + desta task como bullets de aceite):

1. `npx prisma validate`
2. Create first user com senha ainda 201 quando tenant vazio
3. POST invites platform com tenant já com user → 409
4. POST tenant invites com Super Admin → 403
5. Accept público sem Bearer
6. Change-password com senha atual errada não troca hash
7. Reset-password de colega (Admin) ainda existe

### Critérios de aceite

- [ ] Joi com defaults; gym-ctrl sobe sem as vars novas no `.env`
- [ ] `npx prisma validate` passa
- [ ] Checklist dos escapes (senha / reset colega) escrito no FRONT-INTEGRATION

### Não fazer

- Não tornar `JWT_SECRET` opcional
- Não commitar `.env`

---

## Verificação do grupo

```bash
npx prisma validate
```

Collection JSON válido; FRONT-INTEGRATION na pasta da change.

## Handoff para próxima task

Change implementável ponta a ponta. Front consome Swagger + este handoff. Pronto para `/opsx-manager-apply` ou archive depois de aplicar.
