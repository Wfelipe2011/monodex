# Checklist — Rodar o monodex localmente

> Artefato de exploração (2026-08-04). Destinado a um agent/dev executar o bootstrap local.
> README raiz ainda é o template Nest genérico — este arquivo é a fonte prática.

## Visão do monorepo

```
                    ┌──────────────┐
                    │  PostgreSQL  │  (externo — não há no docker-compose)
                    └──────┬───────┘
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌────────────┐  ┌────────────┐  ┌────────────┐
    │  gym-ctrl  │  │  captura   │  │  notifly   │
    │ Auth JWT   │  │ Scraping   │  │ WhatsApp   │
    │ :GYM_PORT  │  │ :3200/8000 │  │ Cloud API  │
    │ (ex: 3001) │  │ Puppeteer  │  │ :3100/3000 │
    └────────────┘  └────────────┘  └────────────┘
```

Três apps NestJS independentes compartilhando o mesmo Prisma/Postgres.

| App | Script dev | Porta default | Função |
|-----|------------|---------------|--------|
| `gym-ctrl` | `npm run gym:dev` | `GYM_PORT` (`.env` hoje: 3001) | Login JWT + health |
| `captura` | `npm run captura:dev` | `CAPTURA_PORT` ou 3200 | Scraping Google Maps + Baileys |
| `notifly` | `npm run notifly:dev` | `NOTIFLY_PORT` ou 3100 | WhatsApp Cloud + webhooks + crons |

Ou tudo junto: `npm run start:dev`.

---

## Pré-requisitos

- [ ] **Node 20** (Dockerfiles usam `node:20`; `.nvmrc` está corrompido — não confiar nele)
- [ ] **npm** (há `package-lock.json`)
- [ ] **PostgreSQL** acessível via `DATABASE_URL`
  - Compose **não** sobe Postgres — aponta para instância externa
- [ ] (Opcional) Chrome/Chromium se for rodar scraping do captura
- [ ] (Opcional) Conta Meta WhatsApp Cloud + `WHATSAPP_TOKEN` se for rodar notifly com envio real
- [ ] (Opcional) Acesso ao Baileys em `baileys.wfelipe.com.br` se for rodar outreach do captura

---

## Passo a passo

### 1. Dependências

```bash
npm install
```

### 2. Variáveis de ambiente (`.env` na raiz)

Mínimo sugerido (use placeholders — **nunca commitar secrets reais**):

```env
DATABASE_URL="postgresql://USER:PASS@HOST:PORT/DB?connection_limit=300"

# gym-ctrl
GYM_PORT=3001
JWT_SECRET=troque-isto

# notifly
NOTIFLY_PORT=3000
NOTIFLY_JWT_SECRET=troque-isto   # presente no .env atual; confirmar se é usado
WHATSAPP_TOKEN=                   # obrigatório para envio real
META_APP_ID=                      # App ID Meta — upload Resumable (handles template/profile)

# captura (opcional)
CAPTURA_PORT=3200
# WHATSAPP_USERNAME / WHATSAPP_PASSWORD aparecem no compose do captura,
# mas o código TypeScript atual autentica no Baileys via user do DB (id=4).
```

Atenção: o `.env` atual aponta para um Postgres remoto de produção/staging. Para desenvolvimento local, preferir um DB próprio.

### 3. Prisma

```bash
npx prisma generate
npx prisma migrate deploy
# ou, em dev com schema em mudança:
# npx prisma migrate dev
```

Migrations em `prisma/migrations/`.

### 4. Dados iniciais (gap importante)

**Não há seed oficial** que crie `Tenant`, `User` e `Coin`.

O que existe hoje:

| Arquivo | O que faz | Útil para bootstrap? |
|---------|-----------|----------------------|
| `seed.ts` | Lê `leads.json`, consulta leads por phone | Não — não escreve tenants/users |
| `adquirirLeads.ts` | Compra leads com `tenantId=4` / `userId=4` | Só se esses IDs já existirem |
| `leads.json` | Dump legado (~grande) | Importação ad hoc, não setup limpo |

Para login no gym funcionar, é preciso ter pelo menos um `User` com password bcrypt + `Tenant` associado. Opções:

1. Usar o banco remoto já populado (risco: mexer em dados reais)
2. Criar manualmente via `npx prisma studio` / SQL
3. Escrever um seed real (fora do escopo deste checklist — ver MD de DB)

### 5. Subir apps

```bash
# um por um (recomendado no primeiro boot)
npm run gym:dev
npm run captura:dev
npm run notifly:dev

# ou todos
npm run start:dev
```

Swagger: `http://localhost:<porta>/api` em cada app.

### 6. Smoke tests

| Check | Como |
|-------|------|
| Gym health | `GET http://localhost:3001/health-check` |
| Gym login | `POST http://localhost:3001/auth/login` `{ "email", "password" }` |
| Captura health | `GET http://localhost:3200/` → `{ status: 'ok' }` |
| Notifly health | `GET http://localhost:3000/health-check` |
| Welcome page | `GET http://localhost:3000/sites/welcome/<uuid>` |

---

## Docker (alternativa)

| Arquivo | App |
|---------|-----|
| `docker-compose.yml` / `Dockerfile.captura` | captura (porta 8000, instala Chrome) |
| `docker-compose-gym.yml` / `Dockerfile.gym` | gym |
| `docker-compose-notifly.yml` / `Dockerfile.notifly` | notifly |

Composes de gym/notifly/captura referenciam imagens `wfelipe2011/*:master` ou build local. Ainda dependem de `DATABASE_URL` externo.

---

## Armadilhas conhecidas

1. **Notifly chama `handleCron()` no `onModuleInit`** — ao subir, pode começar a contatar leads (tenant hardcoded). Cuidado em banco de produção.
2. **Crons do captura estão comentados** — scraping/contato podem não rodar sozinhos.
3. **`.nvmrc` inválido** — pin manual em Node 20.
4. **Sem AuthGuard em captura/notifly** — endpoints abertos.
5. **README não documenta o monorepo** — este arquivo substitui temporariamente.

---

## Critério de "está rodando"

- [ ] Prisma gera client e migrations aplicam sem erro
- [ ] Gym responde health + login com user do DB
- [ ] Captura responde `GET /`
- [ ] Notifly responde health (envio WhatsApp pode ficar desligado sem token)

Envio real de mensagem / scraping completo **não** são necessários para considerar o stack "up".
