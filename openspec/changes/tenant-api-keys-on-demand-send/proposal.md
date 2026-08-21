## Why

O gym-ctrl hoje só autentica humanos com JWT: o tenant não consegue plugar o próprio sistema na Cloud API da plataforma. Precisamos de um canal on-demand (PWA e `X-API-KEY`) para disparar templates granted a qualquer número, com cobrança em coins, inbox, mídia hospedada por nós e agendamento por data/hora.

## What Changes

- Super Admin **concede** ao tenant a capacidade de API (`apiAccessEnabled`). Tenant Admin cria até **3** chaves ativas (`X-API-KEY`); plaintext só na criação; hash no banco.
- Dual-auth nas rotas allowlist: JWT (PWA) **ou** `X-API-KEY`. Chave válida fora da allowlist continua 401. `/platform/*` nunca aceita chave.
- Allowlist: templates granted (GET), send on-demand + status de entrega, conversas (GET/POST texto), mídia (upload/list), agendas (CRUD/cancelar). GET público de mídia sem auth.
- Novo POST de envio de template (PWA e chave): 1 destinatário + 1 template granted, número livre, número **dedicado** obrigatório, cria thread `OUT template`. Super Admin **só lê** (POST 403).
- Terceiro preço de plataforma `costPerOnDemandSend` (Super Admin). `0` fecha o canal. Mesmo gatilho `coinDebitOnStatus` de cidade/lista: **não** debitar no Graph 200; debitar/estornar no webhook. Falha antes do Graph (saldo, grant, imagem, inativo) **não** debita.
- Biblioteca de imagens do tenant (upload PWA e chave, listagem, GET público por id). Arquivo no disco do gym-ctrl; path no banco. Substitui hospedagem em repo GitHub. Cron configurável (~15 dias) apaga arquivos órfãos no disco (sem row no banco). Persistência/volume de disco fica fora do MVP.
- Agendamento **one-shot**: 1 destinatário + 1 template + data e hora (`America/Sao_Paulo`). Cancelável enquanto pendente. Na hora H, se grant/saldo/imagem/dedicado/preço falhar → status FAILED, sem Graph, sem débito.
- **Não** abre cidade, lista, scrape, coins, users, convites, WS/push via chave.

## Capabilities

### New Capabilities

- `tenant-api-keys`: grant Super Admin, CRUD de até 3 chaves ativas, hash/prefixo, revogação, identidade sintético `ADMIN` do tenant.
- `on-demand-template-send`: POST/GET de disparo avulso, preço `costPerOnDemandSend`, gates (grant, dedicado, ativo, preço > 0), variáveis texto + `imageId`, thread, status de entrega.
- `tenant-media-library`: upload, listagem por tenant, GET público, URL HTTPS para header Graph, limpeza de órfãos.
- `on-demand-send-schedule`: agenda 1:1 por data/hora, cancelamento, disparo no notifly, falha sem cobrança.

### Modified Capabilities

- `tenant-operator-api`: dual-auth JWT ou `X-API-KEY` na allowlist; chave fora da allowlist 401; Super Admin não envia neste canal.
- `tenant-template-grants`: listagem via chave devolve o mesmo conjunto granted do Admin JWT.
- `whatsapp-conversation-inbox`: chave autenticada como Admin do tenant no POST de texto; send on-demand no dedicado grava `OUT template`.
- `admin-platform-config`: Super Admin escreve `apiAccessEnabled` e `costPerOnDemandSend`.
- `tenant-outreach-config`: persiste `costPerOnDemandSend` (plataforma); Admin lê, não edita.
- `coin-debit-on-status`: terceiro canal on-demand com `costPerOnDemandSend`, mesmos timestamps/idempotência/reserva.
- `whatsapp-send-status`: status Meta liga a envio on-demand (sem confundir com cidade/lista).
- `platform-job-schedules`: novos `PlatformJobKey` para limpeza de mídia órfã e runner de agendas.

## Impact

- **Prisma:** `Tenant.apiAccessEnabled`; `TenantApiKey`; `TenantMedia`; `TenantOnDemandSend` / `TenantOnDemandSchedule`; `costPerOnDemandSend`; FKs em `WhatsappSendStatus`; enum de jobs.
- **gym-ctrl:** AuthGuard dual-mode; CRUD chaves; send/mídia/agenda; GET público; CORS `X-API-KEY`; cron de órfãos no processo que grava disco.
- **notifly:** worker horário das agendas; `CoinDebitOnStatusService` + webhook para on-demand; reserva de saldo inclui pending deste canal.
- **Front:** grant/preço (Super Admin); chaves, upload, disparo, agenda, inbox (Admin). Sem UI neste repo — `FRONT-INTEGRATION.md`.
- **Fora:** test-send de catálogo (`/platform/whatsapp-templates/:id/test`); cidade/lista; WS/push na chave; volume persistente de disco (follow-up).
