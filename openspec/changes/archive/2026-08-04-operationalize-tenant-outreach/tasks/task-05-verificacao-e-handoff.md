# Task 5 — Verificação e handoff

**Change:** `operationalize-tenant-outreach`
**Grupo:** 5 de 5
**Pré-requisitos:** [2](./task-02-conta-cloud-api-da-plataforma.md), [3](./task-03-config-de-outreach-no-runtime-notifly.md), [4](./task-04-welcome-redirect-por-tenant.md)
**Desbloqueia:** archive / proposta futura Baileys

## Objetivo do grupo

Confirmar manualmente o fluxo Cloud API multi-tenant e deixar explícito no repositório que Baileys/captura outbound ficou fora desta change.

## Contexto para o subagent

- Apps envolvidos: principalmente `notifly`.
- Captura continua existindo com Baileys HTTP; **não** ligar cron comentado como parte desta verificação positiva.
- Explore prévia: `openspec/explore/04-avaliacao-banco-dados.md` (contexto; não precisa atualizar a menos que útil).
- Artefato curto de handoff pode viver em `openspec/changes/operationalize-tenant-outreach/NOTES.md` ou parágrafo em `design.md` Open Questions resolvidas.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `openspec/changes/operationalize-tenant-outreach/NOTES.md` (ou seção em design) | criar/editar |
| (opcional) comentário mínimo em `apps/captura/src/leads.service.ts` no cron comentado | editar |

---

## 5.1 — Checklist manual

### O que fazer

Executar e anotar resultado (pass/fail) em NOTES:

1. **Welcome:** UUID de tenant com phone → redirect; UUID inválido → HTML.
2. **Cron/seleção:** com config enabled em ≥1 tenant (idealmente 2 em dev), logs mostram seleção sem id hardcoded.
3. **Send Cloud:** template outbound usa phoneNumberId da conta plataforma; `TenantLead.messageId` preenchido; coin debit = `costPerLead`.
4. **Webhook Sim:** correlaciona wamid; notifica `Tenant.phone` com template de notify; cashback = config.

Ambientes sem Meta real: documentar o que foi mockado e o que permanece não verificado.

### Critérios de aceite

- [x] Checklist escrito com resultados
- [x] Nenhum passo exige Baileys para passar

### Não fazer

- Não implementar painel admin para “facilitar o teste”

---

## 5.2 — Documentar Cloud oficial vs Baileys futuro

### O que fazer

Registrar em NOTES (e/ou comentário curto no captura):

- Envios oficiais de outreach = WhatsApp Cloud API (notifly).
- Baileys (`baileys.wfelipe.com.br`) e `apps/captura` contactLeads = legado/futuro, fora de `operationalize-tenant-outreach`.
- Open questions remanescentes (billing user canônico; categories/website filters globais).

### Critérios de aceite

- [x] Handoff legível por outro agent sem reler o chat
- [x] Escopo Baileys explícito como future work

### Não fazer

- Não deletar código Baileys nesta change
- Não abrir propose Baileys automaticamente

---

## Verificação do grupo

- Change apply-ready: todas tasks 1–4 done + checklist 5.1 preenchido.
- `openspec status --change operationalize-tenant-outreach` mostra artifacts complete.

## Handoff para próxima task

Pronto para `/opsx-manager-apply` (se ainda houver código) ou `/opsx-archive` após merge. Próxima exploration/proposta natural: Baileys opcional, painel super admin, ou tenantId em Message.
