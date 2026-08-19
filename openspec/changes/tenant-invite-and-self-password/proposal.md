## Why

Hoje o Super Admin só consegue pontapé de um tenant criando o primeiro Admin **já com senha** — e depois está proibido de resetá-la. O Admin do tenant cai no mesmo padrão ao criar colegas. Quem opera a plataforma não deveria conhecer nem aprovar a senha de quem vai usar a conta.

## What Changes

- Convite **sem dados do convidado**: quem gera (Super Admin ou Admin) só copia um link com token curto (TTL da ordem de **horas**). O convidado preenche nome, username, e-mail e senha na página pública do front.
- Dois propósitos: Super Admin convida o **primeiro Admin** do tenant; Admin convida um **USER** da academia.
- Super Admin **continua** podendo criar o primeiro user com senha (`POST /platform/tenants/:id/users` inalterado).
- Qualquer usuário autenticado troca a **própria** senha. Super Admin não aprova nem vê a senha do Admin; Admin não precisa do Super Admin para isso.
- Esqueci-minha-senha sem sessão (mailer / WhatsApp out-of-band) fica **fora**. Reset de senha de colega pelo Admin (`POST .../users/:id/reset-password`) permanece como escape.

## Capabilities

### New Capabilities

- `tenant-invite-links`: emissão, listagem, revogação e aceite público de convites de claim (primeiro Admin e USER de tenant), token curto hasheado, TTL em horas.
- `user-self-password`: usuário autenticado altera a própria senha informando a senha atual; ninguém acima participa.

### Modified Capabilities

- `admin-tenant-lifecycle`: primeiro Admin também pode nascer de convite de plataforma; Admin também convida USER sem senha no create; create-com-senha de plataforma e de tenant permanecem.
- `tenant-operator-api`: emitir convite de primeiro Admin é ação de `/platform`; emitir convite de USER é ação de `/tenant` (Super Admin 403). Aceite público não usa JWT.

## Impact

- **Prisma:** tabela `Invite` (propósito, hash do token, expiry, consumo, tenant).
- **gym-ctrl:** APIs autenticadas de convite em Platform e Tenant; rotas `@Public()` de preview/aceite; `POST /auth/change-password`.
- **Front (outro repo):** tela pública `/convite/:token` e formulário “alterar minha senha”. Contrato em `FRONT-INTEGRATION.md` + Swagger + Postman.
- **Fora:** mailer, notifly, captura, esqueci-senha deslogado, telas neste repo.
