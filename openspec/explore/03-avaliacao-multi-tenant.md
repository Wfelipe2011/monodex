# Avaliação multi-tenant — o que é / o que não é

> Artefato de exploração (2026-08-04). Destinado a um agent avaliar profundamente isolamento, riscos e um plano de correção.
> Complementa `02-painel-super-admin.md` e `04-avaliacao-banco-dados.md`.

## Veredito em uma frase

O **schema é multi-tenant**; a **operação não é**. Vários caminhos críticos usam `tenantId` hardcoded ou ignoram tenant.

---

## Mapa mental

```
                    POOL GLOBAL
              ┌───────────────────┐
              │  Lead (sem tenant)│  ← compartilhado entre todos
              │  City / Neighbor  │  ← geo compartilhado (ok?)
              └─────────┬─────────┘
                        │ TenantLead (com tenantId)
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
     Tenant 4      Tenant 8      Tenant N
     (captura      (notifly
      hardcoded)    cron hardcoded)
```

---

## O que É multi-tenant (schema)

Tabelas com `tenantId` / relation com `Tenant`:

| Model | Observação |
|-------|------------|
| `Tenant` | Entidade raiz; tem `uuid`, `phone?` |
| `User` | `tenantId` obrigatório; `@@unique([email, tenantId])` mas `email` também `@unique` global — tensão! |
| `Session` (`whatsapp_sessions`) | Por user + tenant |
| `Webhooks` | Por user + tenant |
| `TenantLead` | Join tenant ↔ lead + flags de funil |
| `UserLead` | Aquisição user ↔ tenantLead |
| `Coin` | Saldo `@@unique([userId, tenantId])` |
| `CoinTransaction` | Histórico com tenant |

JWT do gym carrega `tenantId` (`libs/contracts/user-token.ts` via auth.service) — base correta, mas pouco usada em APIs de domínio.

Roles: `ADMIN` / `USER` = papéis **dentro do tenant**, não da plataforma.

---

## O que NÃO é multi-tenant (schema)

| Model | Por quê |
|-------|---------|
| `Lead` | Pool global; isolamento só via `TenantLead` |
| `City` / `Neighborhood` | Geo global (pode ser intencional) |
| `WhatsapContact` / `Message` | Conversas sem tenant — risco de mistura |
| `Contacts` | Só `userId`, sem `tenantId` direto |

### Design question para o agent avaliador

`Lead` global: intentional marketplace (um lead vendido a um tenant) ou bug de modelagem?

Hoje o fluxo sugere **marketplace**:
1. Captura popula `Lead` global
2. Tenant "compra"/contata via `TenantLead` + debita `Coin`

Se for marketplace, ok `Lead` sem tenant. Se cada tenant tiver sua própria captura, o modelo muda.

---

## Hardcodes operacionais (quebra real)

| Local | Valor | Impacto |
|-------|-------|---------|
| `apps/captura/src/leads.service.ts` | `tenantId: 4`, `userId: 4` | Todo outreach do captura vai para um tenant |
| `apps/notifly/src/leads.service.ts` | cron filtra `tenant.id: 8` | Só um tenant é processado no schedule |
| `apps/notifly/src/WhatsappController.ts` | mapa UUID→telefone em memória | Ignora `Tenant.uuid` / `Tenant.phone` do DB |
| `adquirirLeads.ts` | `tenantId/userId = 4` | Script de migração acoplado |
| `seed.ts` | constante `tenat = 4` | Irrelevante hoje (seed não escreve) |
| Meta Graph URL | phone number ID fixo `688645744332614` | Uma conta WhatsApp para todos |
| Templates / textos / preço `0.35` | no código | Sem config por tenant |

### Inconsistência captura vs notifly

```
captura  → força tenant 4
notifly  → cron só tenant 8
deleteOldLeads (notifly) → SEM filtro de tenant (varre todos)
```

Dois "clientes" aparentes no código, com comportamentos diferentes por app.

---

## Onde o isolamento falha no código

### 1. Auth não cobre as apps que mexem em dados de tenant

- `gym-ctrl`: AuthGuard ativo, mas só tem login/health
- `captura` / `notifly`: **sem AuthGuard** — qualquer um chama endpoints

### 2. JWT tem tenantId, mas ninguém filtra por ele nas APIs de negócio

Não há controllers de "meus leads", "meu saldo", etc. no gym. Domínio vive nos workers com hardcode.

### 3. Email unique global vs unique composto

```prisma
email  String  @unique
@@unique([email, tenantId])
```

O `@unique` em `email` sozinho impede o mesmo email em dois tenants. Avaliar se é desejado.

### 4. Welcome page

Endpoint `/sites/welcome/:uuid` deveria ser:

```
uuid → Tenant.findUnique({ where: { uuid } }) → Tenant.phone → wa.me
```

Hoje é dicionário hardcoded com **dois** UUIDs.

### 5. Conta WhatsApp única

Uma única Meta WABA / phone number ID no notifly. Multi-tenant comercial completo exigiria conta (ou número) por tenant **ou** envio white-label sob uma conta da plataforma (modelo atual implícito).

---

## Classificação sugerida para decisões

| Domínio | Classificação sugerida | Motivo |
|---------|------------------------|--------|
| Leads brutos (scraping) | **Global / marketplace** | Um pool, múltiplos compradores via TenantLead |
| Cities / Neighborhoods | **Global** | Fonte do scraper |
| Saldo / transações | **Por tenant** | Já modelado |
| Funil contacted/replied | **Por tenant** (`TenantLead`) | Já modelado |
| Sessões WhatsApp (Baileys) | **Por tenant/user** | Schema ok; uso captura hardcoded |
| Mensagens Cloud API | **Plataforma** hoje | Uma WABA; se mudar, modelar `WhatsappAccount` |
| Webhooks | **Por tenant** | Schema ok; pouco explorado |
| Contacts / Messages locais | **Ambíguo** | Falta tenantId — revisar |

---

## Riscos

1. **Vazamento de dados** entre tenants se endpoints futuros filtram mal
2. **Cobrança errada** — debitar sempre user/tenant 4 enquanto contata para outro
3. **deleteOldLeads** global pode afetar tenants não processados pelo cron
4. **Onboarding impossível sem código** — novo tenant exige mudar hardcodes
5. **Mensagens** (`WhatsapContact`/`Message`) sem tenant = forense difícil

---

## Perguntas abertas (agent deve fechar)

1. Marketplace de leads vs captura isolada por tenant?
2. Uma WABA da plataforma ou número por cliente?
3. `ADMIN` do tenant deve ver só seus dados; quem opera cross-tenant é só SUPER_ADMIN?
4. Captura continua app separado "batch" ou vira jobs parametrizados por tenant?
5. Email único global permanece?

---

## Direção de correção (rascunho, não implementação)

Ordem sugerida de valor:

1. Remover hardcodes — workers iteram tenants elegíveis (saldo > X, enabled, phone preenchido)
2. Welcome page ler `Tenant` do DB
3. Extrair pricing / templates / WABA config para DB (ver MD 04)
4. Proteger endpoints sensíveis
5. Formalizar role de plataforma (ver MD 02)
6. Revisar models sem tenant (`Message`, `Contacts`)

---

## Arquivos-chave para o agent

- `prisma/schema.prisma`
- `apps/captura/src/leads.service.ts`
- `apps/notifly/src/leads.service.ts`
- `apps/notifly/src/WhatsappController.ts`
- `apps/gym-ctrl/src/modules/auth.service.ts`
- `libs/guard/`
- `adquirirLeads.ts`
