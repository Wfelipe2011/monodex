import 'reflect-metadata';
import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { InboxInboundEventDto } from './dto/inbox-inbound-event.dto';
import { InternalSecretGuard } from './guards/internal-secret.guard';
import { buildPushPayload } from './inbox-web-push.service';
import { InternalInboxRealtimeController } from './internal-inbox-realtime.controller';

const inboundMessage = {
  id: 1,
  wamid: 'wamid.xxx',
  direction: 'IN' as const,
  type: 'text',
  body: 'oi',
  phone: '5511999998888',
  createdAt: '2026-08-19T12:00:00.000Z',
};

const validPayload = {
  type: 'message.inbound' as const,
  tenantId: 4,
  conversationId: 88,
  displayName: 'Maria',
  message: inboundMessage,
};

describe('InboxInboundEventDto', () => {
  it('aceita payload com conversationId e displayName', async () => {
    const dto = plainToInstance(InboxInboundEventDto, validPayload);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejeita payload legado sem conversationId (listId/leadId)', async () => {
    const dto = plainToInstance(InboxInboundEventDto, {
      type: 'message.inbound',
      tenantId: 4,
      listId: 12,
      leadId: 99,
      leadName: 'Maria',
      message: inboundMessage,
    });
    const errors = await validate(dto);
    const properties = errors.map((error) => error.property);
    expect(properties).toContain('conversationId');
  });
});

describe('buildPushPayload', () => {
  it('usa tag, deep link e data da thread', () => {
    const payload = buildPushPayload(validPayload);
    expect(payload.tag).toBe('inbox-conversation-88');
    expect(payload.title).toBe('Nova mensagem de Maria');
    expect(payload.data.url).toBe('/tenant/4/conversations/88');
    expect(payload.data).toEqual({
      url: '/tenant/4/conversations/88',
      tenantId: 4,
      conversationId: 88,
      messageId: 1,
    });
    expect(payload.data).not.toHaveProperty('listId');
    expect(payload.data).not.toHaveProperty('leadId');
  });

  it('usa telefone no título quando displayName está vazio', () => {
    const payload = buildPushPayload({
      ...validPayload,
      displayName: '  ',
    });
    expect(payload.title).toBe('Nova mensagem de +55 (11) 99999-8888');
  });
});

describe('InternalInboxRealtimeController', () => {
  it('mantém POST /internal/inbox/realtime/notify e InternalSecretGuard', () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, InternalInboxRealtimeController),
    ).toBe('internal/inbox/realtime');
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        InternalInboxRealtimeController.prototype.notify,
      ),
    ).toBe('notify');
    expect(
      Reflect.getMetadata(GUARDS_METADATA, InternalInboxRealtimeController),
    ).toEqual([InternalSecretGuard]);
  });
});
