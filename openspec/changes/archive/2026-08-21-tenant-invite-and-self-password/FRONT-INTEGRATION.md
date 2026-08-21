# Integração front — convite de tenant e troca da própria senha

Handoff para o PWA/Next (não vive neste repo). Use **este arquivo + Swagger**.

**Change:** `tenant-invite-and-self-password`  
**Swagger:** `swagger-spec.json` na raiz do monorepo, ou `GET /api` no gym-ctrl (Authorize → Bearer). Tags: `Platform — Tenant Invites`, `Tenant — Invites`, `Public — Invites`, `Autenticação`.  
**Breaking:** não. Additive. Create-com-senha de plataforma e de tenant **permanece** (escape / seed). Paths de users, login JWT e reset de colega **não mudaram**.

Login e JWT **não mudaram**: `POST /auth/login` → `{ "token": "<JWT>" }`. Aceite de convite devolve o **mesmo** shape. Tags `Platform — *` = `SUPER_ADMIN`. Tags `Tenant — *` = `ADMIN` no `jwt.tenantId`. Role `USER` **não** opera `/tenant/*` hoje (`RolesAuth` é ADMIN).

---

## O que mudou (produto)

Antes: Super Admin só pontapeava o tenant criando o primeiro Admin **já com senha**. Admin criava colegas do mesmo jeito. Quem gerava a conta conhecia a senha.

Agora:

- Super Admin, depois de criar o tenant, emite um convite **sem** nome/e-mail/senha do Admin e copia o `url`.
- Admin do tenant convida um **USER** pelo mesmo padrão (prefixo `/tenant`).
- O convidado abre `/convite/:token`, vê a academia, preenche identidade + senha, entra já logado.
- Qualquer usuário autenticado troca a **própria** senha (`POST /auth/change-password`). Super Admin não aprova nem vê.

Não há mailer. Quem gera manda o link fora da plataforma (WhatsApp). Tratar `url` / `token` como **segredo** — claim aberto: quem tem o link vira a conta.

---

## Checklist para o front

1. **Super Admin — copiar convite** após `POST /platform/tenants`: botão que chama `POST /platform/tenants/:tenantId/invites` (body `{}`) e copia `url`. **Não** pedir nome/e-mail/senha do Admin nesse fluxo.
2. **Admin — convidar USER**: mesmo padrão em `POST /tenant/:tenantId/invites`. Copiar `url`. Sem identidade no create.
3. **Página pública** `/convite/:token`: `GET` preview (nome da academia + `purpose`); form nome, username, e-mail, senha; `POST` accept; guardar JWT e entrar logado.
4. **Roteamento pós-aceite:** `FIRST_ADMIN` → painel Admin. `TENANT_USER` → **não** mandar USER para o painel operador — tela simples / “conta criada” / login. USER não chama `/tenant/*`.
5. **Alterar senha** (logado): `POST /auth/change-password`. Super Admin **não** participa. Sem tela de “esqueci a senha” deslogado.
6. **Env do PWA:** `INVITE_PUBLIC_BASE_URL` no gym-ctrl deve ser a **origin do PWA**, não a do gym-ctrl. Sem ela, a API devolve path relativo `/convite/{token}`.
7. Create-com-senha permanece como escape (não remover as telas/requests existentes).

---

## Env

| Var (gym-ctrl) | Obrigatória? | Default | Uso no front |
|----------------|--------------|---------|--------------|
| `INVITE_TTL_HOURS` | não | `8` (min 1, max 48) | Mostrar “link válido por N horas” no 404 / preview |
| `INVITE_PUBLIC_BASE_URL` | não | vazio → `url` relativo | Origin do PWA, ex. `https://app.example.com` |

Dev local sobe **sem** essas vars no `.env`.

---

## 1. Super Admin — emitir convite FIRST_ADMIN

Tag Swagger: **Platform — Tenant Invites**  
Auth: Bearer `SUPER_ADMIN`

| Método | Path | Body |
|--------|------|------|
| POST | `/platform/tenants/:tenantId/invites` | `{}` (sem identidade) |
| GET | `/platform/tenants/:tenantId/invites` | — (sem `token` / `tokenHash`) |
| POST | `/platform/tenants/:tenantId/invites/:inviteId/revoke` | — |

Só se o tenant **ainda não** tiver users. Novo POST revoga o `FIRST_ADMIN` pendente anterior.

### JSON de emissão (201)

```json
{
  "id": 1,
  "purpose": "FIRST_ADMIN",
  "token": "A2B3C4D5",
  "url": "https://app.example.com/convite/A2B3C4D5",
  "expiresAt": "2026-08-19T23:00:00.000Z"
}
```

`token` plaintext **só** nesta response. Copiar `url` para o clipboard (não o token isolado, salvo se o PWA montar o path). Se `INVITE_PUBLIC_BASE_URL` estiver vazio:

```json
{
  "id": 1,
  "purpose": "FIRST_ADMIN",
  "token": "A2B3C4D5",
  "url": "/convite/A2B3C4D5",
  "expiresAt": "2026-08-19T23:00:00.000Z"
}
```

UI: prefixar com a origin do PWA.

### GET listagem (item)

Sem `token`. Status derivado: `PENDING` | `CONSUMED` | `REVOKED` | `EXPIRED`.

```json
{
  "id": 1,
  "tenantId": 4,
  "purpose": "FIRST_ADMIN",
  "status": "PENDING",
  "expiresAt": "2026-08-19T23:00:00.000Z",
  "consumedAt": null,
  "revokedAt": null,
  "createdByUserId": 1,
  "createdAt": "2026-08-19T15:00:00.000Z",
  "updatedAt": "2026-08-19T15:00:00.000Z"
}
```

---

## 2. Admin — emitir convite TENANT_USER

Tag Swagger: **Tenant — Invites**  
Auth: Bearer `ADMIN` do tenant. **Super Admin → 403** no POST e no revoke (GET de listagem Super Admin pode ler).

| Método | Path |
|--------|------|
| POST | `/tenant/:tenantId/invites` |
| GET | `/tenant/:tenantId/invites` |
| POST | `/tenant/:tenantId/invites/:inviteId/revoke` |

Mesmo JSON de emissão, com `"purpose": "TENANT_USER"`. Vários `PENDING` permitidos. Aceite cria `roles: ["USER"]` — **não** `ADMIN`.

Quem precisa de outro Admin usa o escape create-com-senha (`POST /tenant/:tenantId/users` com `"roles": ["ADMIN"]`), não este convite.

---

## 3. Página pública `/convite/:token`

Tag Swagger: **Public — Invites**  
**Sem Bearer.** Token de 8 caracteres no path (alfabeto Crockford). Rate limit in-memory: 20 req / 15 min por IP → 429.

| Método | Path | Uso |
|--------|------|-----|
| GET | `/public/invites/:token` | Preview: academia + purpose + TTL |
| POST | `/public/invites/:token/accept` | Criar user + JWT |

### Preview (200)

```json
{
  "purpose": "FIRST_ADMIN",
  "tenantName": "Academia Centro",
  "tenantId": 4,
  "expiresAt": "2026-08-19T23:00:00.000Z"
}
```

Título da página: nome da academia. Copy do purpose: primeiro Admin vs conta de equipe.

**404** (token desconhecido, expirado, revogado ou consumido) → mensagem única: **“link inválido ou expirado”**. Mencionar TTL (default **8 horas**). Não enumerar o motivo.

### Accept — body

```json
{
  "name": "Maria Silva",
  "username": "maria.admin",
  "email": "maria@academia.com",
  "password": "senha-segura"
}
```

Sem `roles` no body. Senha min 6. 201:

```json
{
  "token": "<jwt>"
}
```

Igual login. Guardar o JWT e entrar logado.

| `purpose` no preview | Role criada | Depois do aceite |
|----------------------|-------------|------------------|
| `FIRST_ADMIN` | `ADMIN` | Painel Admin (`/tenant/:tenantId/*`) |
| `TENANT_USER` | `USER` | **Não** operar o painel. Tela “conta criada” / login simples. `RolesAuth` das rotas `/tenant/*` é `ADMIN` — USER leva 403 |

Tenant inativo no aceite → **403**. E-mail/username duplicado → **409**, convite **não** consome. `FIRST_ADMIN` com tenant já com user → **409**.

---

## 4. Alterar a própria senha

Tag Swagger: **Autenticação**  
Auth: Bearer de **quem está logado** (`SUPER_ADMIN`, `ADMIN` ou `USER`). Sem `@RolesAuth`. Super Admin **não** troca senha de outra pessoa por este path.

| Método | Path |
|--------|------|
| POST | `/auth/change-password` |

```json
{
  "currentPassword": "antiga",
  "newPassword": "nova-senha"
}
```

200: `{ "ok": true }`. Senha atual errada → **401**, hash **não** muda. JWTs já emitidos **não** são invalidados (TTL 1d como o login).

**Fora desta change:** esqueci-senha deslogado (não há mailer). Não inventar `POST /public/password-resets`.

---

## 5. Escapes que **não** saem (create-com-senha e reset de colega)

Convite é o caminho feliz, não o único.

| Fluxo | Path | Quem | Continua? |
|-------|------|------|-----------|
| Primeiro user com senha | `POST /platform/tenants/:tenantId/users` | Super Admin, tenant **vazio** | **Sim** — seed / “preciso desse Admin agora”. Revoga `FIRST_ADMIN` pendentes na hora |
| Colega com senha | `POST /tenant/:tenantId/users` | Admin do tenant | **Sim**. Super Admin → 403 |
| Reset senha de colega | `POST /tenant/:tenantId/users/:userId/reset-password` | Admin do tenant | **Sim**. Super Admin → 403 |
| Troca da própria senha | `POST /auth/change-password` | o próprio user | novo |
| Esqueci-senha deslogado | — | — | **não existe** |

Admin único que esqueceu a senha **não** tem self-service deslogado. Super Admin **não** reseta. Escape operacional: SQL / suporte fora desta change, ou o Admin ainda logado usa change-password.

---

## Erros úteis para toast

| HTTP | Onde | Motivo típico |
|------|------|----------------|
| 401 | change-password | JWT ausente/inválido ou senha atual incorreta |
| 403 | POST/revoke tenant invites | Super Admin, tenant inativo ou Admin de outro tenant |
| 403 | accept público | tenant `active=false` |
| 404 | preview / accept | link inválido ou expirado (mensagem genérica) |
| 404 | platform/tenant invites | tenant ou convite inexistente |
| 409 | POST platform invites / accept FIRST_ADMIN | tenant já possui usuários |
| 409 | accept | e-mail/username duplicado (convite segue pendente) |
| 409 | revoke | convite não está `PENDING` |
| 429 | GET/POST públicos | rate limit por IP |

---

## Como conferir no Swagger / Postman

1. Suba o gym-ctrl → `http://<host>:<GYM_PORT>/api`.
2. Authorize `SUPER_ADMIN` → tag **Platform — Tenant Invites**. Collection: **Platform — Invites** (`{{platformToken}}`).
3. Authorize `ADMIN` → tag **Tenant — Invites**. Collection: **Tenant — Invites** (`{{tenantToken}}`). Super Admin neste POST deve ser 403.
4. **Public — Invites** na collection: **sem** Bearer. Preview + Accept com `{{inviteToken}}` gravado no Create 201.
5. **Auth → Change Password** com Bearer. **Platform — First User → Create First User** e **Tenant — Users → Reset Password** continuam na collection.

---

## Checklist de verificação (escapes + convite)

QA / time. Create-com-senha e reset de colega **não** podem ter sumido.

| # | Critério | Evidência |
|---|----------|-----------|
| 1 | `npx prisma validate` | schema + migration `Invite` / `InvitePurpose` |
| 2 | Create first user com senha ainda **201** quando o tenant está vazio | `POST /platform/tenants/:tenantId/users` — Postman **Create First User** |
| 3 | POST invites platform com tenant já com user → **409** | `POST /platform/tenants/:tenantId/invites` |
| 4 | POST tenant invites com Super Admin → **403** | `POST /tenant/:tenantId/invites` com `{{platformToken}}` |
| 5 | Accept público **sem** Bearer | `POST /public/invites/:token/accept` — folder **Public — Invites** `noauth` |
| 6 | Change-password com senha atual errada **não** troca o hash | `POST /auth/change-password` → 401 |
| 7 | Reset-password de colega (Admin) **ainda existe** | `POST /tenant/:tenantId/users/:userId/reset-password` — Postman **Reset Password** |

Não há e-mail transacional. Não prometar envio do link pela plataforma.
