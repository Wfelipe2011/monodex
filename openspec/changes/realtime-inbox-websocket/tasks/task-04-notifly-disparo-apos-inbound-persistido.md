# Task 4 — notifly — Disparo após inbound persistido

**Change:** `realtime-inbox-websocket`
**Grupo:** 4 de 5
**Pré-requisitos:** [task-01-dependencias-e-configuracao.md](./task-01-dependencias-e-configuracao.md), [task-03-gym-ctrl-endpoint-interno-de-notify.md](./task-03-gym-ctrl-endpoint-interno-de-notify.md)
**Desbloqueia:** [task-05-contrato-postman-e-verificacao.md](./task-05-contrato-postman-e-verificacao.md)

## Objetivo do grupo

Após persistir inbound de lead de lista, notifly notifica gym-ctrl via HTTP sem bloquear webhook Meta.

## Contexto para o subagent

- Hook point: `apps/notifly/src/notifly.controller.ts` — loop `handleInboundMessage`.
- Retorno: `{ persisted: boolean, correlation: ... }` de `WebhookPersistenceService`.
- Mensagem criada em `webhook-persistence.service.ts` — após create, não retorna row; controller pode re-query ou estender retorno.
- **Recomendado:** estender `InboundHandleResult` com campos opcionais quando persisted:
  - `tenantId`, `listLeadId`, `messageId`, `wamid`, `type`, `body`, `phone`, `createdAt`
  - Evita query extra no controller.

- `listId`: `prisma.tenantListLead.findUnique({ where: { id: listLeadId }, select: { listId: true } })`

- `HttpModule` já importado em `NotiflyModule`.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/notifly/src/inbox-realtime-notify.service.ts` | criar |
| `apps/notifly/src/webhook-persistence.service.ts` | editar (enriquecer retorno) |
| `apps/notifly/src/notifly.controller.ts` | editar (chamar notify) |
| `apps/notifly/src/notifly.module.ts` | editar (provider) |

---

## 4.1 — InboxRealtimeNotifyService

### O que fazer

```typescript
@Injectable()
export class InboxRealtimeNotifyService {
  private readonly logger = new Logger(...);

  constructor(private readonly http: HttpService) {}

  async notifyInbound(payload: InboxInboundEventPayload): Promise<void> {
    const base = process.env.GYM_CTRL_BASE_URL;
    const secret = process.env.INTERNAL_WS_NOTIFY_SECRET;
    if (!base || !secret) {
      this.logger.warn('GYM_CTRL_BASE_URL or INTERNAL_WS_NOTIFY_SECRET missing; skip notify');
      return;
    }
    try {
      await this.http.axiosRef.post(
        `${base.replace(/\/$/, '')}/internal/inbox/realtime/notify`,
        payload,
        {
          headers: { 'X-Internal-Secret': secret, 'Content-Type': 'application/json' },
          timeout: 5000,
        },
      );
    } catch (err) {
      this.logger.error(`inbox realtime notify failed: ${err.message}`);
      // não rethrow
    }
  }
}
```

Tipo `InboxInboundEventPayload` espelha DTO gym-ctrl (pode duplicar interface leve no notifly ou shared lib — preferir duplicar mínima para escopo pequeno).

Chamada **fire-and-forget**: `void this.notifyService.notifyInbound(...)` no controller (não await bloqueante) **ou** await dentro try/catch que nunca propaga — webhook sempre 200.

### Critérios de aceite

- [ ] Falha HTTP não altera resposta 200 do webhook
- [ ] Erro logado com contexto (tenantId, leadId)

### Não fazer

- Retry elaborate / fila
- Notify em outbound ou status webhook

---

## 4.2 — Integração no webhook

### O que fazer

1. Em `handleInboundMessage`, após create bem-sucedido, incluir no return:
   - `tenantId`, `listLeadId`, e snapshot da message (`id`, `wamid`, `type`, `body`, `phone`, `createdAt`)

2. Em `NotiflyController.responseLeads`, após `handleInboundMessage`:

```typescript
if (result.persisted && result.listLeadId != null && result.tenantId != null) {
  const listLead = await this.prisma.tenantListLead.findUnique({
    where: { id: result.listLeadId },
    select: { listId: true },
  });
  if (listLead) {
    void this.inboxRealtimeNotify.notifyInbound({
      type: 'message.inbound',
      tenantId: result.tenantId,
      listId: listLead.listId,
      leadId: result.listLeadId,
      message: {
        id: result.messageId,
        wamid: result.wamid,
        direction: 'IN',
        type: result.type,
        body: result.body ?? undefined,
        phone: result.phone,
        createdAt: result.createdAt.toISOString(),
      },
    });
  }
}
```

3. **Não** notify quando `persisted: false` (duplicate wamid) ou sem `listLeadId`.

4. Registrar provider em `NotiflyModule`.

### Critérios de aceite

- [ ] Simular webhook inbound com context de list send → WS client recebe evento end-to-end
- [ ] Inbound tenant_lead (cidade) sem listLeadId → sem POST notify
- [ ] Duplicate wamid → sem notify

### Não fazer

- Alterar lógica `ListCampaignReplyService` / `LeadsService`

---

## Verificação do grupo

1. gym-ctrl + notifly rodando com mesmo secret
2. WS conectado com JWT SUPER_ADMIN
3. POST webhook simulado ou seed message via prisma + manual notify
4. Evento aparece no WS

## Handoff para próxima task

Fluxo E2E backend completo; falta documentação e checklist formal.
