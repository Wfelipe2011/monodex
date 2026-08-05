# Task 2 — Conta Cloud API da plataforma

**Change:** `operationalize-tenant-outreach`
**Grupo:** 2 de 5
**Pré-requisitos:** [1](./task-01-schema-e-migration.md)
**Desbloqueia:** [3](./task-03-config-de-outreach-no-runtime-notifly.md)

## Objetivo do grupo

Centralizar resolução da conta WhatsApp Cloud API da plataforma e eliminar o Phone Number ID hardcoded nas URLs Graph do notifly.

## Contexto para o subagent

- App: `apps/notifly`
- Hoje `apps/notifly/src/leads.service.ts` posta em:
  - `https://graph.facebook.com/v22.0/688645744332614/messages` (em `contactLeads` e `responseLeads`)
  - Header `Authorization: Bearer ${process.env.WHATSAPP_TOKEN}`
- Module: `apps/notifly/src/notifly.module.ts` — providers atuais: `LeadsService`; imports: `PrismaModule`, `ScheduleModule`, `HttpModule`
- Token **nunca** vai para o DB; model usa `tokenEnvKey`.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/notifly/src/platform-whatsapp.service.ts` (nome sugerido) | criar |
| `apps/notifly/src/notifly.module.ts` | editar |
| `apps/notifly/src/leads.service.ts` | editar |

---

## 2.1 — Serviço de resolução da conta plataforma

### O que fazer

Criar um provider Nest (ex. `PlatformWhatsappService`) que:

1. Busca `WhatsappAccount` com `tenantId: null`, `enabled: true`, `provider: CLOUD_API`.
2. Lê `process.env[account.tokenEnvKey]`.
3. Expõe algo equivalente a `{ phoneNumberId, token, messagesUrl }` onde  
   `messagesUrl = https://graph.facebook.com/v22.0/${phoneNumberId}/messages`.
4. Falha com erro/log claro se conta ou token ausentes.

Registrar no `NotiflyModule.providers` e injetar onde necessário.

### Critérios de aceite

- [x] Serviço obtém phoneNumberId do DB, não de literal no código do resolver
- [x] Token vem só do env apontado por `tokenEnvKey`
- [x] Provider registrado no module

### Não fazer

- Não implementar fluxo Baileys
- Não criar conta por tenant ainda (só plataforma)

---

## 2.2 — Substituir Phone Number ID hardcoded

### O que fazer

Em `apps/notifly/src/leads.service.ts`, trocar as duas (ou mais) ocorrências da URL com `688645744332614` pelo `messagesUrl`/phoneNumberId resolvido pelo serviço da task 2.1.

Manter version path `v22.0` a menos que design diga o contrário.

### Critérios de aceite

- [x] `rg "688645744332614" apps/notifly` retorna vazio (exceto talvez comentários/docs que devem ser removidos também)
- [x] Envios de contato e notificação ao tenant usam a mesma resolução

### Não fazer

- Não alterar payloads de template além do necessário para plugar a URL/token

---

## 2.3 — Token apenas em env

### O que fazer

Revisar create/update paths e seeds: garantir ausência de coluna/campo preenchido com token real. O serviço deve rejeitar env vazio.

### Critérios de aceite

- [x] Nenhum write Prisma grava o valor de `WHATSAPP_TOKEN`
- [x] Se env faltando, send falha de forma observável (log/exception)

### Não fazer

- Não logar o token completo em clear text (evitar `console.log('env', { WHATSAPP_TOKEN })` existente — remover ou mascarar)

---

## Verificação do grupo

- Subir notifly com DB seedado e `WHATSAPP_TOKEN` setado.
- Disparar um send (ou unit-ish call do resolver) e confirmar URL montada com o phoneNumberId do registro.

## Handoff para próxima task

`LeadsService` já consegue obter credenciais da plataforma. Task 3 troca seleção de tenants e lê `TenantOutreachConfig` para pricing/templates/schedule.
