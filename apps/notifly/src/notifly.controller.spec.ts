import { NotiflyController } from './notifly.controller';
import { InboundHandleResult } from './webhook-persistence.service';
import { WhatsAppWebhook } from './interfaces';

function webhookBody(phoneNumberId: string): WhatsAppWebhook {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '1',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '5511999990000',
                phone_number_id: phoneNumberId,
              },
              contacts: [
                { profile: { name: 'Maria' }, wa_id: '5511999998888' },
              ],
              messages: [
                {
                  from: '5511999998888',
                  id: 'wamid.in.1',
                  timestamp: '1710000000',
                  type: 'text',
                  text: { body: 'oi' },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

describe('NotiflyController inbound notify', () => {
  function build(result: InboundHandleResult) {
    const webhookPersistence = {
      handleInboundMessage: jest.fn().mockResolvedValue(result),
      handleStatus: jest.fn().mockResolvedValue(undefined),
    };
    const inboxRealtimeNotify = {
      notifyInbound: jest.fn().mockResolvedValue(undefined),
    };
    const prisma = {
      tenantListLead: { findUnique: jest.fn() },
      tenantListSend: { findUnique: jest.fn() },
    };
    const controller = new NotiflyController(
      { responseLeads: jest.fn() } as never,
      prisma as never,
      webhookPersistence as never,
      { handleButtonReply: jest.fn() } as never,
      inboxRealtimeNotify as never,
    );
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    return { controller, inboxRealtimeNotify, webhookPersistence, res };
  }

  it('frio dedicado notifica com conversationId e displayName', async () => {
    const { controller, inboxRealtimeNotify, webhookPersistence, res } = build({
      persisted: true,
      correlation: 'dedicated_number',
      tenantId: 11,
      conversationId: 88,
      displayName: 'Maria',
      listLeadId: null,
      messageId: 50,
      wamid: 'wamid.in.1',
      type: 'text',
      body: 'oi',
      phone: '5511999998888',
      createdAt: new Date('2026-08-18T12:00:00.000Z'),
    });

    await controller.responseLeads(
      webhookBody('999000111222'),
      {},
      res as never,
    );

    expect(webhookPersistence.handleInboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'wamid.in.1' }),
      expect.objectContaining({ phone_number_id: '999000111222' }),
      expect.arrayContaining([
        expect.objectContaining({ wa_id: '5511999998888' }),
      ]),
    );
    expect(inboxRealtimeNotify.notifyInbound).toHaveBeenCalledTimes(1);
    expect(inboxRealtimeNotify.notifyInbound).toHaveBeenCalledWith({
      type: 'message.inbound',
      tenantId: 11,
      conversationId: 88,
      displayName: 'Maria',
      message: {
        id: 50,
        wamid: 'wamid.in.1',
        direction: 'IN',
        type: 'text',
        body: 'oi',
        phone: '5511999998888',
        createdAt: '2026-08-18T12:00:00.000Z',
      },
    });
    expect(inboxRealtimeNotify.notifyInbound.mock.calls[0][0]).not.toHaveProperty(
      'listId',
    );
    expect(inboxRealtimeNotify.notifyInbound.mock.calls[0][0]).not.toHaveProperty(
      'leadId',
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('default skip não chama gym-ctrl', async () => {
    const { controller, inboxRealtimeNotify, res } = build({
      persisted: false,
      correlation: 'unknown',
    });

    await controller.responseLeads(
      webhookBody('1292251013966333'),
      {},
      res as never,
    );

    expect(inboxRealtimeNotify.notifyInbound).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
