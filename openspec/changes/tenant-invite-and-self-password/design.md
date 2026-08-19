## Context

O Super Admin cria o tenant em `POST /platform/tenants` e o primeiro user em `POST /platform/tenants/:tenantId/users` com `{ name, username, email, password }`. Só vale se o tenant ainda não tem users. Senha é bcrypt. Super Admin está **proibido** de PATCH/reset de users (`403`) — senha é tenant-owned.

O Admin cria colegas no mesmo DTO (com senha) em `/tenant/:tenantId/users`. `User.password` é `String` obrigatório. Não há mailer. `@Public()` já existe (`POST /auth/login`). Front é outro repo.

Quem gera o convite **não informa** quem vai usá-lo: só copia um link curto. O convidado preenche os dados. Super Admin ainda pode criar o primeiro user com senha (escape / seed).

## Goals / Non-Goals

**Goals:**

- Super Admin emite convite de **primeiro Admin** (claim, sem PII) e copia o link.
- Admin emite convite de **USER** do tenant (claim, sem PII) e copia o link.
- Token curto, TTL da ordem de horas, uso único, hash no banco.
- Página pública no front: preview + aceite (nome, username, e-mail, senha).
- Usuário autenticado troca a **própria** senha (senha atual + nova). Ninguém acima aprova.
- Create-com-senha de plataforma (primeiro user) e de tenant (colega) **permanecem**.

**Non-Goals:**

- Mailer / WhatsApp para entregar o link (quem gera copia e manda fora da plataforma).
- Esqueci-senha deslogado (precisa canal out-of-band que não existe).
- Convite de um segundo Admin pela plataforma; Super Admin criar USER.
- Tornar `User.password` opcional; user “pendente”.
- Telas neste repo; captura; notifly.

## Decisions

### D1 — Tabela `Invite`; User só no aceite

**Escolha:** `Invite` com `purpose`, `tokenHash`, `expiresAt`, `consumedAt`, `revokedAt`, `tenantId`. `User` nasce no aceite, com senha hasheada, como hoje.

**Por quê:** `password` continua NOT NULL; login não precisa tratar pendente; convite expirado não deixa row de user zumbi.

**Alternativa rejeitada:** User sem senha + status PENDING. Obriga login a recusar pendente e migration em `password`.

### D2 — Claim aberto: create sem body de identidade

**Escolha:** `POST` de emissão com body vazio (ou `{}`). Sem e-mail, nome ou username. Quem tem o link preenche tudo no aceite.

**Por quê:** Pedido explícito — quem gera só copia o link. Operação comercial: Super Admin manda o URL no Zap da academia.

**Alternativa rejeitada:** Convite amarrado a e-mail. Melhor anti-sequestro, mas exige dado que o gerador não quer (e não tem mailer para provar o e-mail).

### D3 — Token curto (8), hash SHA-256, TTL 8h

**Escolha:** 8 caracteres no alfabeto Crockford (`23456789ABCDEFGHJKLMNPQRSTUVWXYZ`, 32 símbolos). Persistido só `sha256(hex)` unique. TTL default **8 horas** (`INVITE_TTL_HOURS`). `crypto` do Node; sem `nanoid`.

**Por quê:** “Token curto, coisa de horas.” 32^8 ≈ 1.1e12; com TTL curto e rate limit no público, brute force na URL é inviável. Hash impede listar tokens pelo banco.

**Alternativa rejeitada:** UUID/base64url 32 bytes (link feio). TTL de dias (janela grande demais para claim aberto).

Raw token **só** na response do POST de emissão. GET de listagem nunca devolve o plaintext. Reemitir gera token novo e revoga o FIRST_ADMIN pendente anterior daquele tenant.

### D4 — Dois propósitos, papéis fixos

| `InvitePurpose` | Quem emite | Path | Role no aceite | Cardinalidade pendente |
|-----------------|------------|------|----------------|------------------------|
| `FIRST_ADMIN` | `SUPER_ADMIN` | `POST /platform/tenants/:tenantId/invites` | `ADMIN` | no máximo um PENDING por tenant (novo POST revoga o anterior) |
| `TENANT_USER` | `ADMIN` do tenant | `POST /tenant/:tenantId/invites` | `USER` | vários PENDING |

**Por quê:** Espelha o recorte atual (primeiro Admin = plataforma; equipe = tenant) sem o gerador escolher role. Super Admin em `POST` de TENANT_USER → **403** (igual create adicional de user).

**Alternativa rejeitada:** Um convite genérico com `roles` no body (reintroduz decisão do gerador). Link de claim sem propósito (primeiro a abrir vira Admin mesmo depois de já existir Admin).

Emissão `FIRST_ADMIN` se o tenant **já tem** user → **409**. Aceite `FIRST_ADMIN` se meanwhile alguém criou user (senha ou outro convite) → **409**, convite marcado consumido/revogado para não ficar reutilizável.

### D5 — Create-com-senha permanece

**Escolha:** `POST /platform/tenants/:tenantId/users` e `POST /tenant/:tenantId/users` **não saem**. Seed, suporte e “preciso desse Admin agora” continuam.

**Por quê:** Pedido explícito. Convite é o caminho feliz, não o único.

Se existir user, convite `FIRST_ADMIN` pendente não pode ser aceito. Se o Super Admin criar o user com senha, convites `FIRST_ADMIN` PENDING daquele tenant devem ser revogados no create (ou o aceite falha por count > 0 — fazer os dois: revogar no create-com-senha e recusar no aceite).

### D6 — Superfície pública no gym-ctrl, página no front

**Escolha:**

```
GET  /public/invites/:token          → { purpose, tenantName, expiresAt }
POST /public/invites/:token/accept   → { name, username, email, password }
                                     → { token }  (JWT, mesmo contrato do login)
```

`@Public()`, **sem** `@RolesAuth` (RolesGuard hoje quebra se `user` é undefined e há roles). Token na URL, não Bearer.

Front: `{INVITE_PUBLIC_BASE_URL}/convite/{token}`. Env opcional; se vazio, `url` na emissão é path relativo `/convite/{token}`.

**Por quê:** Fonte da verdade é o gym-ctrl. Front só é casca, como nas outras changes (`FRONT-INTEGRATION.md`). JWT no aceite evita bounce extra no login.

**Alternativa rejeitada:** Aceite só cria user e manda para `/login` (mais um round-trip; válido, mas pior UX). Front persistir o convite.

Preview 404 para token inexistente, expirado, revogado ou consumido — mesma mensagem genérica (não enumerar estados para quem tenta adivinhar). Rate limit in-memory por IP nos dois endpoints públicos (ex. 20/15 min). Sem Redis; uma instância de gym-ctrl.

### D7 — Troca de senha própria no `/auth`

**Escolha:** `POST /auth/change-password` com Bearer, body `{ currentPassword, newPassword }`. Qualquer role autenticada (`SUPER_ADMIN`, `ADMIN`, `USER`). `bcrypt.compare` da atual; `bcrypt.hash` da nova (10 rounds, igual create). **Não** envolve Super Admin nem Admin do tenant. **Não** invalida JWTs já emitidos (TTL 1d como hoje).

**Por quê:** “Se o Admin quiser trocar a senha dele, o Super Admin não precisa saber nem aprovar.” Esqueci-senha deslogado **não** entra: sem mailer, devolver o token no `POST { email }` é takeover.

**Alternativa rejeitada:** Super Admin/Admin gerarem link de reset para o de baixo (envolve o usuário acima). `POST /public/password-resets { email }` devolvendo URL.

`POST /tenant/:tenantId/users/:userId/reset-password` **permanece** (Admin redefine senha de colega, escape). Super Admin continua 403 nesse path.

### D8 — Status derivado, não enum persistido

**Escolha:** `consumedAt` / `revokedAt` / `expiresAt`. Status na API: `PENDING` | `CONSUMED` | `REVOKED` | `EXPIRED`.

Aceite e preview em transação: marcar `consumedAt` e criar `User` no mesmo `prisma.$transaction`. Conflito unique de e-mail/username → **409**, convite **não** consome.

Tenant `active=false`: emissão platform ainda pode (Super Admin opera `/platform`); aceite público **403/409**; emissão tenant já cai no `TenantActiveGuard`.

### D9 — Módulos

| Peça | Onde |
|------|------|
| `InvitePurpose` + model `Invite` | `prisma/schema.prisma` + migration |
| `generateInviteToken` / `hashInviteToken` / `inviteExpiresAt` | `libs/shared/invite-token.ts` |
| Emissão/lista/revoke | `InvitesService` + controllers em `apps/gym-ctrl/src/modules/admin/` |
| Preview/aceite | controller `@Public()` no gym-ctrl (admin ou auth); reusa `InvitesService` + `AuthService` para JWT |
| Change password | `AuthController` / `AuthService` |
| Env | `INVITE_TTL_HOURS` (default 8), `INVITE_PUBLIC_BASE_URL` (opcional) no Joi do `GymModule` |

`Tenant.invites Invite[]`. Não mexer em captura/notifly.

## Risks / Trade-offs

- **[Claim aberto]** Quem tem o link vira Admin/USER da academia. → TTL curto, um FIRST_ADMIN pendente por tenant, revogação, rate limit, HTTPS no front. Operador trata o link como segredo (igual senha temporária, mas sem o Super Admin conhecê-la).
- **[Token curto]** Espaço menor que UUID. → Alfabeto 32 × 8 + TTL horas + rate limit + hash. Não logar o token em plaintext (cuidado com o `AuthGuard` que hoje loga Bearer).
- **[Lockout]** Admin único que esqueceu a senha continua sem self-service deslogado. → Escape: Super Admin **não** reseta; precisa de SQL ou (fora desta change) mailer. Create-com-senha não ajuda se o user já existe. Documentar no FRONT-INTEGRATION.
- **[USER]** Aceite de tenant cria `roles: [USER]`. Rotas `/tenant/*` hoje são `RolesAuth(ADMIN, SUPER_ADMIN)` — USER loga mas **não** opera o painel. Intencional neste recorte (equipe não-operadora). Quem precisa de outro Admin usa create-com-senha do Admin (roles `[ADMIN]`) ou um convite futuro de role (fora).
- **[Rate limit in-memory]** Multi-instância não compartilha contador. → Aceitável no gym-ctrl atual (um processo). Redis fica para depois.

## Migration Plan

1. Migration só adiciona `invites` + enum `InvitePurpose`. Sem backfill. Rollback = drop table/enum.
2. Deploy gym-ctrl com as rotas novas. Front: botão “copiar convite” + rota pública `/convite/:token` + “alterar senha”.
3. Create-com-senha não quebra clientes Postman/Swagger existentes.

## Open Questions

Nenhum bloqueante. Role do convite de tenant ficou **USER** (pedido “admin para user”). Se o produto precisar convidar outro Admin por link, é extensão: `purpose` extra ou body opcional — não nesta change.
