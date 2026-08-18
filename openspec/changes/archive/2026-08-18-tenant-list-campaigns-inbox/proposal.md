## Why

Hoje o outreach oficial só contacta leads do pool global (scrape por cidade), com funil `TenantLead` e config fixa por tenant. Super-admins precisam disparar templates WhatsApp Cloud API sobre listas próprias de destinatários (cadastro manual ou importação), cobrar coins por envio, agendar lotes, reagir a respostas por botão — e conduzir conversas de texto pela plataforma (Meta API + webhook), sem Baileys. O webhook atual persiste inbound de forma incompleta e ignora statuses; não há API de conversa nem rastreio de falhas de entrega.

## What Changes

- Nova entidade irmã de `Lead`: destinatários de lista por tenant (sem `cityId`/`rating`; `category` opcional), com importação de planilha (contrato documentado + arquivo de exemplo para download).
- Nova entidade de lista por tenant com `costPerSend` configurável e telefone único por lista.
- Nova entidade de agendamento (campanha): template do catálogo, bindings, janela de schedule (mesmo formato JSON do outreach), `sendsPerRun`, intervalo entre envios; múltiplos agendamentos por lista; lead indisponível para outros templates após envio aceito pela Graph, exceto se status `failed`.
- Ações configuráveis por botão QUICK_REPLY do template de disparo: `NOTIFY` (template de notify + bindings) ou `NOOP`; sem cashback.
- Persistência separada: **mensagens de conversa** (inbound + outbound, texto e botão no MVP) e **status de envio** (`sent` / `delivered` / `read` / `failed`) para o front organizar falhas.
- Webhook notifly: processar `messages` e `statuses`, correlacionar por `wamid` / `context.id`, corrigir bugs atuais (optional chaining, múltiplas entries).
- APIs `SUPER_ADMIN` no gym-ctrl: CRUD de listas/leads/campanhas, import, histórico de conversa, envio de texto livre (janela 24h Meta), consulta de status. Sem telas neste repo; polling no front (socket fica fora de escopo).
- Cron no notifly: executor de campanhas de lista, separado do `contactLeads` de cidade.
- Vocabulário de categorias: sugestões a partir do scrape/listas existentes; na importação persistir valores da planilha com normalização leve (ex.: `clínica` ≈ `clinica`), sem amarrar ao catálogo de cidades.

## Capabilities

### New Capabilities

- `tenant-list-leads`: listas por tenant, leads irmãos, cadastro manual, import de planilha, contrato de colunas, telefone único por lista, categorias livres com normalização.
- `tenant-list-campaigns`: agendamentos sobre listas, envio via catálogo, débito de coins, seleção de lote, lock de lead entre campanhas, ações de botão NOTIFY/NOOP.
- `whatsapp-conversation-inbox`: armazenamento de mensagens inbound/outbound, API de histórico e envio de texto Cloud API, correlacionadas a lead de lista.
- `whatsapp-send-status`: armazenamento de statuses Meta por `wamid`, liberação de lead em `failed`, consulta para UI de falhas.

### Modified Capabilities

- `template-slot-bindings`: estender enum de binding com fontes `recipient.*` (name, phone, category, website, reviews) para campanhas de lista; manter conjunto fechado existente para outreach de cidade.

## Impact

- Prisma: novos modelos (`TenantLeadList`, `TenantListLead`, `TenantListCampaign`, `TenantListSend`, `WhatsappConversationMessage`, `WhatsappSendStatus` ou nomes equivalentes); possível deprecar/evoluir `Message`/`WhatsapContact` legados.
- gym-ctrl: módulo admin de listas/campanhas/conversas; endpoints de download de planilha exemplo.
- notifly: webhook reescrito/estendido; cron de campanhas; gravação outbound no envio de template e texto.
- `@core/shared`: resolver de bindings `recipient.*`; possível helper de normalização de categoria.
- Sem cashback; sem socket; permissões permanecem `SUPER_ADMIN` only.
- Outreach de cidade (`Lead`/`TenantLead`/`contactLeads`) permanece; inbox desta change foca leads de lista, mas webhook persiste eventos de forma genérica.
