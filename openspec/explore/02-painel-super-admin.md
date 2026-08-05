# Painel Super Admin — base para proposta futura

> Artefato de exploração (2026-08-04). **Não é uma proposta OpenSpec ainda.**
> Objetivo: dar contexto suficiente para um agent gerar `/opsx-propose` (ou propose-v2) depois.

## Estado atual

### Existe painel de super admin?

**Não.**

| O que existe | O que não existe |
|--------------|------------------|
| `Roles` enum: `ADMIN`, `USER` (por tenant) | Role `SUPER_ADMIN` / platform admin |
| Login JWT só no `gym-ctrl` | UI web administrativa |
| Swagger em `/api` | CRUD de tenants via API |
| `CreateUserDto` órfão (sem controller) | CRUD de users via API |
| `public/index.html` (landing estática) | Dashboard, billing, config por tenant |
| Tenant no schema (`Tenant`, relations) | Isolamento operacional real (IDs hardcoded) |

Auth hoje:

```
POST /auth/login  →  JWT { id, userId, userName, roles, tenantId }
                              │
                              ▼
                     AuthGuard (só gym-ctrl)
                     RolesGuard existe, mas NENHUMA rota usa @RolesAuth
```

Conclusão: `ADMIN` = admin **do tenant**, não da plataforma. E mesmo esse papel quase não é usado.

---

## Problema que o painel resolve

Hoje onboarding/config é feito "na mão":

- Tenant/user/coins criados direto no banco
- UUID→telefone do welcome em mapa hardcoded (`WhatsappController`)
- Phone Number ID Meta, templates, custos, crons, mensagens hardcoded no código
- Sem visão consolidada de saldo, leads contatados, tenants ativos

Um super admin é o operador da **plataforma**, acima dos tenants.

```
                    ┌─────────────────────┐
                    │    SUPER ADMIN      │  ← não existe
                    │  (plataforma)       │
                    └──────────┬──────────┘
           ┌───────────────────┼───────────────────┐
           ▼                   ▼                   ▼
     ┌──────────┐        ┌──────────┐        ┌──────────┐
     │ Tenant A │        │ Tenant B │        │ Tenant C │
     │ ADMIN    │        │ ADMIN    │        │ ADMIN    │
     │ USER...  │        │ USER...  │        │ USER...  │
     └──────────┘        └──────────┘        └──────────┘
```

---

## Escopo sugerido — "base apenas" (MVP)

Foco: o mínimo para operar a plataforma sem SQL manual. Deixar fora billing avançado, analytics ricos, white-label.

### Must-have (MVP)

1. **Modelo de identidade de plataforma**
   - Role `SUPER_ADMIN` **ou** tabela `PlatformUser` separada (preferível separar platform vs tenant users — evita ambiguidade)
   - Auth no `gym-ctrl` (ou app novo `admin-api`) com guard exclusivos

2. **CRUD de Tenants**
   - Criar / listar / editar / desativar
   - Campos: `name`, `phone`, `uuid` (já no schema)
   - Expor `phone` para welcome (`/sites/welcome/:uuid`) em vez do mapa hardcoded

3. **CRUD de Users do tenant**
   - Criar admin inicial do tenant
   - Reset password
   - Listar por tenant

4. **Moedas (saldo)**
   - Ver balance por user/tenant
   - Creditar / debitar com `CoinTransaction` (tipos já existem: `CREDITO`, `DEBITO`, `BONUS`…)

5. **Leitura operacional**
   - Contagem de leads no pool global
   - TenantLeads por tenant (contacted / replied / quoted / closed)
   - Últimas transações

6. **UI mínima**
   - Uma SPA ou páginas server-rendered autenticadas
   - Alternativa temporária: só API + Swagger (pior UX, ok para bootstrap)

### Nice-to-have (próxima onda)

- Config por tenant: token WhatsApp / phone number ID / templates / preço do lead / janelas de cron
- Toggle liga/desliga outreach do tenant
- Impersonate tenant admin (perigoso — precisa auditoria)
- Gestão de Cities/Neighborhoods (fonte do scraper)
- Auditoria de ações do super admin

### Explicitamente fora do MVP

- App mobile
- Multi-idioma
- Billing/Stripe
- Editor de templates WhatsApp visual

---

## Onde encaixa no monorepo

Opções (para a proposta decidir):

| Opção | Prós | Contras |
|-------|------|---------|
| **A.** Expandir `gym-ctrl` | Já tem auth JWT, Swagger, nome "Gestão de Leads" | Mistura platform API com tenant API |
| **B.** Novo app `admin` / `platform` | Separação clara | Mais um serviço/porta/deploy |
| **C.** Frontend separado (Next/Vite) + gym como BFF | UI de verdade | Escopo maior |

Recomendação de partida para proposta: **A + UI mínima**, ou **B** se quiser isolar desde o início.

---

## Dependências / riscos

1. Multi-tenant operacional ainda está quebrado (ver `03-avaliacao-multi-tenant.md`) — painel que só CRUD tenants sem parar hardcodes **não resolve outreach**.
2. Config crítica ainda está em código (ver `04-avaliacao-banco-dados.md`) — painel precisa de tabelas novas ou só edita o que já está no schema.
3. Captura/notifly sem auth — painel não protege esses endpoints sozinho.
4. `.env` com DB remoto — cuidado ao testar cruds.

---

## Critérios de aceite sugeridos (para a proposta)

- [ ] Super admin consegue criar um tenant + user admin + crédito inicial sem SQL
- [ ] Welcome page resolve telefone pelo `Tenant` no DB (não mapa em memória)
- [ ] Super admin lista saldo e tenant_leads de qualquer tenant
- [ ] User `ADMIN` de um tenant **não** acessa endpoints de super admin
- [ ] Não há necessidade de editar código para onboarding de um novo cliente (exceto secrets WhatsApp até existirem configs)

---

## Próximo passo sugerido

Quando for formalizar:

```
/opsx-propose painel-super-admin
```

ou `/opsx-propose-v2` se quiser tasks prontas para subagents.

Insumos para o proposal agent:

- Este arquivo
- `03-avaliacao-multi-tenant.md` (limites do isolamento)
- `04-avaliacao-banco-dados.md` (o que precisa virar tabela)
- Schema atual: `prisma/schema.prisma`
- Auth atual: `apps/gym-ctrl/src/modules/auth.*`, `libs/guard/`
