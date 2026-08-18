# Task 3 — gym-ctrl — Endpoint interno de notify

**Change:** `realtime-inbox-websocket`
**Grupo:** 3 de 5
**Pré-requisitos:** [task-02-gym-ctrl-gateway-websocket.md](./task-02-gym-ctrl-gateway-websocket.md)
**Desbloqueia:** [task-04-notifly-disparo-apos-inbound-persistido.md](./task-04-notifly-disparo-apos-inbound-persistido.md)

## Objetivo do grupo

Endpoint HTTP interno que recebe payload `message.inbound` do notifly e faz fan-out WebSocket.

## Contexto para o subagent

- Não existe padrão `/internal` no repo — criar novo controller.
- Usar `@Public()` ou guard dedicado que valida header vs `INTERNAL_WS_NOTIFY_SECRET`.
- Decorator `@Public()` em `libs/decorators/public.decorator.ts` bypassa AuthGuard JWT.
- Payload deve espelhar design D4.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/gym-ctrl/src/modules/inbox-realtime/internal-inbox-realtime.controller.ts` | criar |
| `apps/gym-ctrl/src/modules/inbox-realtime/dto/inbox-inbound-event.dto.ts` | criar |
| `apps/gym-ctrl/src/modules/inbox-realtime/guards/internal-secret.guard.ts` | criar (ou inline) |
| `apps/gym-ctrl/src/modules/inbox-realtime/inbox-realtime.module.ts` | editar |

---

## 3.1 — POST /internal/inbox/realtime/notify

### O que fazer

**Guard `InternalSecretGuard`**

- Lê `X-Internal-Secret` header
- Compare com `ConfigService.get('INTERNAL_WS_NOTIFY_SECRET')`
- Falha → `UnauthorizedException`

**Controller**

```typescript
@Controller('internal/inbox/realtime')
@Public()
@UseGuards(InternalSecretGuard)
export class InternalInboxRealtimeController {
  @Post('notify')
  @HttpCode(204)
  notify(@Body() dto: InboxInboundEventDto) {
    this.inboxRealtimeService.publishInbound(dto);
  }
}
```

**`publishInbound(dto)`** no service:

- Rooms: [`tenant:${dto.tenantId}`, `super-admin`]
- Enviar JSON `{ type: 'message.inbound', ...dto fields }` (type fixo)
- Dedup rooms antes de broadcast

### Critérios de aceite

- [ ] POST sem header → 401
- [ ] POST com secret errado → 401
- [ ] POST válido → 204 e clientes WS recebem evento

### Não fazer

- Swagger público detalhado com secret
- Persistir nada no banco neste endpoint

---

## 3.2 — DTO InboxInboundEventDto

### O que fazer

```typescript
class InboundMessageDto {
  @IsInt() id: number;
  @IsString() wamid: string;
  @Equals('IN') direction: 'IN';
  @IsString() type: string;
  @IsOptional() @IsString() body?: string;
  @IsString() phone: string;
  @IsISO8601() createdAt: string;
}

class InboxInboundEventDto {
  @Equals('message.inbound') type: 'message.inbound';
  @IsInt() tenantId: number;
  @IsInt() listId: number;
  @IsInt() leadId: number;
  @ValidateNested() @Type(() => InboundMessageDto) message: InboundMessageDto;
}
```

Usar `ValidationPipe` global se já existir no gym-ctrl; senão `@UsePipes` no controller.

### Critérios de aceite

- [ ] Body inválido → 400
- [ ] Body válido passa para fan-out

### Não fazer

- Aceitar `direction: OUT`

---

## Verificação do grupo

Com WS conectado (task 2) e secret configurado:

```bash
curl -X POST http://localhost:3000/internal/inbox/realtime/notify \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: test-secret" \
  -d '{
    "type": "message.inbound",
    "tenantId": 4,
    "listId": 1,
    "leadId": 99,
    "message": {
      "id": 1,
      "wamid": "wamid.test",
      "direction": "IN",
      "type": "text",
      "body": "oi",
      "phone": "5511999999999",
      "createdAt": "2026-08-17T21:00:00.000Z"
    }
  }'
```

Cliente WS deve receber o JSON.

## Handoff para próxima task

Endpoint interno estável; notifly pode POSTar após webhook.
