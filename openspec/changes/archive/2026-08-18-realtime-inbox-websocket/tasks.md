| Grupo | Arquivo de detalhes |
|-------|---------------------|
| 1 | [task-01-dependencias-e-configuracao.md](./tasks/task-01-dependencias-e-configuracao.md) |
| 2 | [task-02-gym-ctrl-gateway-websocket.md](./tasks/task-02-gym-ctrl-gateway-websocket.md) |
| 3 | [task-03-gym-ctrl-endpoint-interno-de-notify.md](./tasks/task-03-gym-ctrl-endpoint-interno-de-notify.md) |
| 4 | [task-04-notifly-disparo-apos-inbound-persistido.md](./tasks/task-04-notifly-disparo-apos-inbound-persistido.md) |
| 5 | [task-05-contrato-postman-e-verificacao.md](./tasks/task-05-contrato-postman-e-verificacao.md) |

**Ordem de execução:** 1 → 2 → 3 → 4 → 5

**Artefatos de contexto:** [proposal.md](./proposal.md) · [design.md](./design.md) · specs

## 1. Dependências e configuração

📄 [Detalhes](./tasks/task-01-dependencias-e-configuracao.md)

- [x] 1.1 Adicionar `@nestjs/websockets`, `@nestjs/platform-ws`, `ws` e `@types/ws`; estender Joi do gym-ctrl com `INTERNAL_WS_NOTIFY_SECRET`, `WS_INBOX_PATH` (default `ws/inbox`)
- [x] 1.2 Configurar env no notifly: `GYM_CTRL_BASE_URL`, `INTERNAL_WS_NOTIFY_SECRET` (validação ou documentação mínima)

## 2. gym-ctrl — Gateway WebSocket

📄 [Detalhes](./tasks/task-02-gym-ctrl-gateway-websocket.md)

- [x] 2.1 `InboxRealtimeModule`: gateway autenticado por JWT, rooms `tenant:{tenantId}` e `super-admin`, registry in-memory
- [x] 2.2 `main.ts`: `WsAdapter`, path configurável; registrar módulo em `GymModule` ou `AdminModule`

## 3. gym-ctrl — Endpoint interno de notify

📄 [Detalhes](./tasks/task-03-gym-ctrl-endpoint-interno-de-notify.md)

- [x] 3.1 `POST /internal/inbox/realtime/notify` protegido por `X-Internal-Secret`
- [x] 3.2 DTO de payload `message.inbound` e fan-out via `InboxRealtimeService`

## 4. notifly — Disparo após inbound persistido

📄 [Detalhes](./tasks/task-04-notifly-disparo-apos-inbound-persistido.md)

- [x] 4.1 `InboxRealtimeNotifyService`: HTTP POST fire-and-forget para gym-ctrl
- [x] 4.2 Chamar após `handleInboundMessage` quando `persisted && listLeadId`; resolver `listId` do lead

## 5. Contrato, Postman e verificação

📄 [Detalhes](./tasks/task-05-contrato-postman-e-verificacao.md)

- [x] 5.1 Documentar contrato JSON do evento e variáveis de ambiente para o front externo
- [x] 5.2 Checklist manual: WS connect + curl notify interno + fan-out observável
