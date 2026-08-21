import { WhatsappDeliveryStatus } from '@prisma/client';
import { WebhookPersistenceService } from './webhook-persistence.service';
import { Contact, Message, Metadata, Status } from './interfaces';

const LIST_TENANT_ID = 3;
const DEDICATED_TENANT_ID = 11;
const CITY_TENANT_ID = 7;
const DEDICATED_ACCOUNT_ID = 2;
const DEFAULT_ACCOUNT_ID = 1;
const DEDICATED_PHONE_NUMBER_ID = '999000111222';
const DEFAULT_PHONE_NUMBER_ID = '1292251013966333';
const LIST_SEND_WAMID = 'wamid.list.out';
const CITY_WAMID = 'wamid.city.out';
const ON_DEMAND_WAMID = 'wamid.ondemand.out';
const ORPHAN_WAMID = 'wamid.orphan';
const FROM_PHONE = '5511999998888';
const CONVERSATION_ID = 88;
const ON_DEMAND_TENANT_ID = 15;
const ON_DEMAND_SEND_ID = 101;

function inboundText(overrides?: Partial<Message>): Message {
  return {
    from: FROM_PHONE,
    id: 'wamid.in.1',
    timestamp: '1710000000',
    type: 'text',
    text: { body: 'oi' },
    ...overrides,
  };
}

function metadata(phoneNumberId: string): Metadata {
  return {
    display_phone_number: '5511999990000',
    phone_number_id: phoneNumberId,
  };
}

function contactMaria(): Contact[] {
  return [{ profile: { name: 'Maria' }, wa_id: FROM_PHONE }];
}

function statusEvent(overrides?: Partial<Status>): Status {
  return {
    id: CITY_WAMID,
    status: 'delivered',
    timestamp: '1710000000',
    recipient_id: FROM_PHONE,
    conversation: {
      id: 'conv.1',
      origin: { type: 'marketing' },
    },
    pricing: {
      billable: true,
      pricing_model: 'CBP',
      category: 'marketing',
    },
    ...overrides,
  };
}

describe('WebhookPersistenceService', () => {
  function build(options?: {
    listSend?: {
      id: number;
      listLeadId: number;
      listLead: { list: { tenantId: number } };
    } | null;
    tenantLead?: { id: number; tenantId?: number } | null;
    onDemandSend?: { id: number; tenantId: number } | null;
    dedicatedAccount?: { id: number; isDefault: boolean } | null;
    outreachConfig?: {
      tenantId: number;
      whatsappAccountId?: number | null;
    } | null;
    existingConversation?: { id: number; displayName: string } | null;
    created?: { id: number };
    billingError?: Error;
  }) {
    const createdAt = new Date('2026-08-18T12:00:00.000Z');
    const prisma = {
      tenantListSend: {
        findUnique: jest.fn().mockResolvedValue(options?.listSend ?? null),
        update: jest.fn().mockResolvedValue({}),
      },
      tenantLead: {
        findFirst: jest.fn().mockResolvedValue(options?.tenantLead ?? null),
        findUnique: jest.fn().mockResolvedValue(options?.tenantLead ?? null),
        update: jest.fn().mockResolvedValue({}),
      },
      tenantOnDemandSend: {
        findUnique: jest
          .fn()
          .mockResolvedValue(options?.onDemandSend ?? null),
        update: jest.fn().mockResolvedValue({}),
      },
      tenantListLead: {
        update: jest.fn().mockResolvedValue({}),
      },
      whatsappSendStatus: {
        create: jest.fn().mockResolvedValue({ id: 1 }),
      },
      whatsappAccount: {
        findFirst: jest.fn().mockResolvedValue(
          options?.dedicatedAccount === undefined
            ? null
            : options.dedicatedAccount,
        ),
        findUnique: jest.fn().mockResolvedValue(
          options?.dedicatedAccount === undefined
            ? null
            : options.dedicatedAccount,
        ),
      },
      tenantOutreachConfig: {
        findUnique: jest.fn().mockResolvedValue(
          options?.outreachConfig === undefined
            ? null
            : options.outreachConfig,
        ),
      },
      whatsappConversation: {
        findUnique: jest
          .fn()
          .mockResolvedValue(options?.existingConversation ?? null),
        upsert: jest.fn().mockImplementation(async (args: {
          create: { displayName: string; phone: string; tenantId: number };
          update: { displayName: string };
        }) => ({
          id: options?.existingConversation?.id ?? CONVERSATION_ID,
          displayName: args.create?.displayName ?? args.update?.displayName,
          phone: args.create?.phone,
          tenantId: args.create?.tenantId,
        })),
      },
      whatsappConversationMessage: {
        create: jest.fn().mockResolvedValue({
          id: options?.created?.id ?? 50,
          wamid: 'wamid.in.1',
          type: 'text',
          body: 'oi',
          phone: FROM_PHONE,
          createdAt,
        }),
      },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );
    const coinDebitOnStatus = {
      applyAfterStatus: options?.billingError
        ? jest.fn().mockRejectedValue(options.billingError)
        : jest.fn().mockResolvedValue(undefined),
    };
    const service = new WebhookPersistenceService(
      prisma as never,
      coinDebitOnStatus as never,
    );
    return { service, prisma, coinDebitOnStatus };
  }

  it('dedicado frio + contacts nome persiste thread com displayName', async () => {
    const { service, prisma } = build({
      dedicatedAccount: { id: DEDICATED_ACCOUNT_ID, isDefault: false },
      outreachConfig: {
        tenantId: DEDICATED_TENANT_ID,
        whatsappAccountId: DEDICATED_ACCOUNT_ID,
      },
    });

    const result = await service.handleInboundMessage(
      inboundText(),
      metadata(DEDICATED_PHONE_NUMBER_ID),
      contactMaria(),
    );

    expect(result.persisted).toBe(true);
    expect(result.correlation).toBe('dedicated_number');
    expect(result.tenantId).toBe(DEDICATED_TENANT_ID);
    expect(result.listLeadId).toBeNull();
    expect(result.conversationId).toBe(CONVERSATION_ID);
    expect(typeof result.conversationId).toBe('number');
    expect(result.displayName).toBe('Maria');
    expect(prisma.whatsappConversation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          tenantId: DEDICATED_TENANT_ID,
          phone: FROM_PHONE,
          displayName: 'Maria',
        }),
      }),
    );
    expect(prisma.whatsappConversationMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: DEDICATED_TENANT_ID,
          conversationId: CONVERSATION_ID,
          listLeadId: null,
          listSendId: null,
          direction: 'IN',
        }),
      }),
    );
  });

  it('dedicado frio sem contacts usa displayName = phone', async () => {
    const { service, prisma } = build({
      dedicatedAccount: { id: DEDICATED_ACCOUNT_ID, isDefault: false },
      outreachConfig: {
        tenantId: DEDICATED_TENANT_ID,
        whatsappAccountId: DEDICATED_ACCOUNT_ID,
      },
    });

    const result = await service.handleInboundMessage(
      inboundText(),
      metadata(DEDICATED_PHONE_NUMBER_ID),
    );

    expect(result.persisted).toBe(true);
    expect(result.conversationId).toBe(CONVERSATION_ID);
    expect(result.listLeadId).toBeNull();
    expect(result.displayName).toBe(FROM_PHONE);
    expect(prisma.whatsappConversation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          displayName: FROM_PHONE,
          phone: FROM_PHONE,
        }),
      }),
    );
  });

  it('default sem assignment não cria WhatsappConversation', async () => {
    const { service, prisma } = build({
      dedicatedAccount: { id: DEFAULT_ACCOUNT_ID, isDefault: true },
    });

    const result = await service.handleInboundMessage(
      inboundText(),
      metadata(DEFAULT_PHONE_NUMBER_ID),
    );

    expect(result.persisted).toBe(false);
    expect(result.correlation).toBe('unknown');
    expect(result.tenantId).toBeUndefined();
    expect(result.conversationId).toBeUndefined();
    expect(prisma.whatsappConversation.upsert).not.toHaveBeenCalled();
    expect(prisma.whatsappConversationMessage.create).not.toHaveBeenCalled();
  });

  it('context list_send no dedicado persiste thread + listLeadId', async () => {
    const { service, prisma } = build({
      listSend: {
        id: 9,
        listLeadId: 42,
        listLead: { list: { tenantId: LIST_TENANT_ID } },
      },
      dedicatedAccount: { id: DEDICATED_ACCOUNT_ID, isDefault: false },
      outreachConfig: {
        tenantId: LIST_TENANT_ID,
        whatsappAccountId: DEDICATED_ACCOUNT_ID,
      },
    });

    const result = await service.handleInboundMessage(
      inboundText({
        context: { from: '5511999990000', id: LIST_SEND_WAMID },
      }),
      metadata(DEDICATED_PHONE_NUMBER_ID),
    );

    expect(result.persisted).toBe(true);
    expect(result.correlation).toBe('list_send');
    expect(result.tenantId).toBe(LIST_TENANT_ID);
    expect(result.listLeadId).toBe(42);
    expect(result.conversationId).toBe(CONVERSATION_ID);
    expect(prisma.whatsappConversationMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: LIST_TENANT_ID,
          conversationId: CONVERSATION_ID,
          listLeadId: 42,
          listSendId: 9,
        }),
      }),
    );
  });

  it('context tenant_lead no dedicado persiste thread com listLeadId null', async () => {
    const { service, prisma } = build({
      tenantLead: { id: 77, tenantId: DEDICATED_TENANT_ID },
      dedicatedAccount: { id: DEDICATED_ACCOUNT_ID, isDefault: false },
      outreachConfig: {
        tenantId: DEDICATED_TENANT_ID,
        whatsappAccountId: DEDICATED_ACCOUNT_ID,
      },
    });

    const result = await service.handleInboundMessage(
      inboundText({
        context: { from: '5511999990000', id: CITY_WAMID },
      }),
      metadata(DEDICATED_PHONE_NUMBER_ID),
    );

    expect(result.persisted).toBe(true);
    expect(result.correlation).toBe('tenant_lead');
    expect(result.tenantId).toBe(DEDICATED_TENANT_ID);
    expect(result.listLeadId).toBeNull();
    expect(result.conversationId).toBe(CONVERSATION_ID);
    expect(prisma.whatsappConversation.upsert).toHaveBeenCalled();
    expect(prisma.whatsappConversationMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          conversationId: CONVERSATION_ID,
          listLeadId: null,
          listSendId: null,
        }),
      }),
    );
  });

  it('context list_send no default não cria thread mas preserva correlação', async () => {
    const { service, prisma } = build({
      listSend: {
        id: 9,
        listLeadId: 42,
        listLead: { list: { tenantId: LIST_TENANT_ID } },
      },
      dedicatedAccount: { id: DEFAULT_ACCOUNT_ID, isDefault: true },
    });

    const result = await service.handleInboundMessage(
      inboundText({
        context: { from: '5511999990000', id: LIST_SEND_WAMID },
      }),
      metadata(DEFAULT_PHONE_NUMBER_ID),
    );

    expect(result.persisted).toBe(false);
    expect(result.correlation).toBe('list_send');
    expect(result.listLeadId).toBe(42);
    expect(result.conversationId).toBeUndefined();
    expect(prisma.whatsappConversation.upsert).not.toHaveBeenCalled();
    expect(prisma.whatsappConversationMessage.create).not.toHaveBeenCalled();
  });

  it('status só-cidade amarra tenantLeadId, atualiza lastStatus e não unlock de lista', async () => {
    const { service, prisma, coinDebitOnStatus } = build({
      tenantLead: { id: 77, tenantId: CITY_TENANT_ID },
    });

    await service.handleStatus(statusEvent({ id: CITY_WAMID, status: 'delivered' }));

    expect(prisma.tenantLead.findUnique).toHaveBeenCalledWith({
      where: { messageId: CITY_WAMID },
    });
    expect(prisma.whatsappSendStatus.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          wamid: CITY_WAMID,
          status: WhatsappDeliveryStatus.delivered,
          listSendId: null,
          tenantLeadId: 77,
          onDemandSendId: null,
        }),
      }),
    );
    expect(prisma.tenantLead.update).toHaveBeenCalledWith({
      where: { id: 77 },
      data: { lastStatus: WhatsappDeliveryStatus.delivered },
    });
    expect(prisma.tenantListSend.update).not.toHaveBeenCalled();
    expect(prisma.tenantListLead.update).not.toHaveBeenCalled();
    expect(prisma.tenantOnDemandSend.update).not.toHaveBeenCalled();
    expect(coinDebitOnStatus.applyAfterStatus).toHaveBeenCalledWith({
      tenantId: CITY_TENANT_ID,
      status: WhatsappDeliveryStatus.delivered,
      listSendId: null,
      tenantLeadId: 77,
      onDemandSendId: null,
    });
  });

  it('status só-lista amarra listSendId, atualiza send e unlock em failed', async () => {
    const { service, prisma, coinDebitOnStatus } = build({
      listSend: {
        id: 9,
        listLeadId: 42,
        listLead: { list: { tenantId: LIST_TENANT_ID } },
      },
    });

    await service.handleStatus(
      statusEvent({ id: LIST_SEND_WAMID, status: 'failed' }),
    );

    expect(prisma.whatsappSendStatus.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          wamid: LIST_SEND_WAMID,
          status: WhatsappDeliveryStatus.failed,
          listSendId: 9,
          tenantLeadId: null,
          onDemandSendId: null,
        }),
      }),
    );
    expect(prisma.tenantListSend.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { lastStatus: WhatsappDeliveryStatus.failed },
    });
    expect(prisma.tenantListLead.update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { sendLockCampaignId: null },
    });
    expect(prisma.tenantLead.update).not.toHaveBeenCalled();
    expect(prisma.tenantOnDemandSend.update).not.toHaveBeenCalled();
    expect(coinDebitOnStatus.applyAfterStatus).toHaveBeenCalledWith({
      tenantId: LIST_TENANT_ID,
      status: WhatsappDeliveryStatus.failed,
      listSendId: 9,
      tenantLeadId: null,
      onDemandSendId: null,
    });
  });

  it('lista delivered chama billing com tenant da lista', async () => {
    const { service, coinDebitOnStatus } = build({
      listSend: {
        id: 9,
        listLeadId: 42,
        listLead: { list: { tenantId: LIST_TENANT_ID } },
      },
    });

    await service.handleStatus(
      statusEvent({ id: LIST_SEND_WAMID, status: 'delivered' }),
    );

    expect(coinDebitOnStatus.applyAfterStatus).toHaveBeenCalledWith({
      tenantId: LIST_TENANT_ID,
      status: WhatsappDeliveryStatus.delivered,
      listSendId: 9,
      tenantLeadId: null,
      onDemandSendId: null,
    });
  });

  it('status on-demand delivered grava onDemandSendId e lastStatus (XOR)', async () => {
    const { service, prisma, coinDebitOnStatus } = build({
      onDemandSend: {
        id: ON_DEMAND_SEND_ID,
        tenantId: ON_DEMAND_TENANT_ID,
      },
    });

    await service.handleStatus(
      statusEvent({ id: ON_DEMAND_WAMID, status: 'delivered' }),
    );

    expect(prisma.tenantOnDemandSend.findUnique).toHaveBeenCalledWith({
      where: { wamid: ON_DEMAND_WAMID },
    });
    expect(prisma.whatsappSendStatus.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          wamid: ON_DEMAND_WAMID,
          status: WhatsappDeliveryStatus.delivered,
          listSendId: null,
          tenantLeadId: null,
          onDemandSendId: ON_DEMAND_SEND_ID,
        }),
      }),
    );
    expect(prisma.tenantOnDemandSend.update).toHaveBeenCalledWith({
      where: { id: ON_DEMAND_SEND_ID },
      data: { lastStatus: WhatsappDeliveryStatus.delivered },
    });
    expect(prisma.tenantLead.update).not.toHaveBeenCalled();
    expect(prisma.tenantListSend.update).not.toHaveBeenCalled();
    expect(prisma.tenantListLead.update).not.toHaveBeenCalled();
    expect(coinDebitOnStatus.applyAfterStatus).toHaveBeenCalledWith({
      tenantId: ON_DEMAND_TENANT_ID,
      status: WhatsappDeliveryStatus.delivered,
      listSendId: null,
      tenantLeadId: null,
      onDemandSendId: ON_DEMAND_SEND_ID,
    });
  });

  it('colisão wamid on-demand+cidade preferência on-demand (XOR)', async () => {
    const { service, prisma, coinDebitOnStatus } = build({
      tenantLead: { id: 77, tenantId: CITY_TENANT_ID },
      onDemandSend: {
        id: ON_DEMAND_SEND_ID,
        tenantId: ON_DEMAND_TENANT_ID,
      },
    });

    await service.handleStatus(
      statusEvent({ id: ON_DEMAND_WAMID, status: 'delivered' }),
    );

    expect(prisma.whatsappSendStatus.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          listSendId: null,
          tenantLeadId: null,
          onDemandSendId: ON_DEMAND_SEND_ID,
        }),
      }),
    );
    expect(prisma.tenantLead.update).not.toHaveBeenCalled();
    expect(prisma.tenantOnDemandSend.update).toHaveBeenCalled();
    expect(coinDebitOnStatus.applyAfterStatus).toHaveBeenCalledWith({
      tenantId: ON_DEMAND_TENANT_ID,
      status: WhatsappDeliveryStatus.delivered,
      listSendId: null,
      tenantLeadId: null,
      onDemandSendId: ON_DEMAND_SEND_ID,
    });
  });

  it('failed de cidade seta contacted=false e chama billing (sem unlock de lista)', async () => {
    const { service, prisma, coinDebitOnStatus } = build({
      tenantLead: { id: 77, tenantId: CITY_TENANT_ID },
    });

    await service.handleStatus(statusEvent({ id: CITY_WAMID, status: 'failed' }));

    expect(prisma.whatsappSendStatus.create).toHaveBeenCalled();
    expect(prisma.tenantLead.update).toHaveBeenCalledWith({
      where: { id: 77 },
      data: {
        lastStatus: WhatsappDeliveryStatus.failed,
        contacted: false,
      },
    });
    expect(prisma.tenantListLead.update).not.toHaveBeenCalled();
    expect(prisma.tenantListSend.update).not.toHaveBeenCalled();
    expect(coinDebitOnStatus.applyAfterStatus).toHaveBeenCalledWith({
      tenantId: CITY_TENANT_ID,
      status: WhatsappDeliveryStatus.failed,
      listSendId: null,
      tenantLeadId: 77,
      onDemandSendId: null,
    });
  });

  it('erro de billing não impede append do status', async () => {
    const { service, prisma, coinDebitOnStatus } = build({
      tenantLead: { id: 77, tenantId: CITY_TENANT_ID },
      billingError: new Error('wallet down'),
    });

    await expect(
      service.handleStatus(statusEvent({ id: CITY_WAMID, status: 'delivered' })),
    ).resolves.toBeUndefined();

    expect(prisma.whatsappSendStatus.create).toHaveBeenCalled();
    expect(prisma.tenantLead.update).toHaveBeenCalled();
    expect(coinDebitOnStatus.applyAfterStatus).toHaveBeenCalled();
  });

  it('status sem match persiste row órfã sem update de lead/send nem billing', async () => {
    const { service, prisma, coinDebitOnStatus } = build();

    await service.handleStatus(
      statusEvent({ id: ORPHAN_WAMID, status: 'sent' }),
    );

    expect(prisma.whatsappSendStatus.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          wamid: ORPHAN_WAMID,
          status: WhatsappDeliveryStatus.sent,
          listSendId: null,
          tenantLeadId: null,
          onDemandSendId: null,
        }),
      }),
    );
    expect(prisma.tenantLead.update).not.toHaveBeenCalled();
    expect(prisma.tenantListSend.update).not.toHaveBeenCalled();
    expect(prisma.tenantListLead.update).not.toHaveBeenCalled();
    expect(prisma.tenantOnDemandSend.update).not.toHaveBeenCalled();
    expect(coinDebitOnStatus.applyAfterStatus).not.toHaveBeenCalled();
  });

  it('status desconhecido não insere nem atualiza', async () => {
    const { service, prisma, coinDebitOnStatus } = build({
      tenantLead: { id: 77, tenantId: CITY_TENANT_ID },
    });

    await service.handleStatus(
      statusEvent({ id: CITY_WAMID, status: 'deleted' }),
    );

    expect(prisma.whatsappSendStatus.create).not.toHaveBeenCalled();
    expect(prisma.tenantLead.update).not.toHaveBeenCalled();
    expect(prisma.tenantListSend.update).not.toHaveBeenCalled();
    expect(prisma.tenantListLead.update).not.toHaveBeenCalled();
    expect(coinDebitOnStatus.applyAfterStatus).not.toHaveBeenCalled();
  });
});
