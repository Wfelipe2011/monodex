import { WebhookPersistenceService } from './webhook-persistence.service';
import { Message, Metadata } from './interfaces';

const LIST_TENANT_ID = 3;
const DEDICATED_TENANT_ID = 11;
const DEDICATED_ACCOUNT_ID = 2;
const DEFAULT_ACCOUNT_ID = 1;
const DEDICATED_PHONE_NUMBER_ID = '999000111222';
const DEFAULT_PHONE_NUMBER_ID = '1292251013966333';
const LIST_SEND_WAMID = 'wamid.list.out';

function inboundText(overrides?: Partial<Message>): Message {
  return {
    from: '5511999998888',
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

describe('WebhookPersistenceService', () => {
  function build(options?: {
    listSend?: {
      id: number;
      listLeadId: number;
      listLead: { list: { tenantId: number } };
    } | null;
    dedicatedAccount?: { id: number; isDefault: boolean } | null;
    outreachConfig?: { tenantId: number } | null;
    created?: { id: number };
  }) {
    const createdAt = new Date('2026-08-18T12:00:00.000Z');
    const prisma = {
      tenantListSend: {
        findUnique: jest.fn().mockResolvedValue(options?.listSend ?? null),
      },
      tenantLead: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      whatsappAccount: {
        findFirst: jest.fn().mockResolvedValue(
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
      whatsappConversationMessage: {
        create: jest.fn().mockResolvedValue({
          id: options?.created?.id ?? 50,
          wamid: 'wamid.in.1',
          type: 'text',
          body: 'oi',
          phone: '5511999998888',
          createdAt,
        }),
      },
    };
    const service = new WebhookPersistenceService(prisma as never);
    return { service, prisma };
  }

  it('context.id de list send vence mesmo se metadata for outro número', async () => {
    const { service, prisma } = build({
      listSend: {
        id: 9,
        listLeadId: 42,
        listLead: { list: { tenantId: LIST_TENANT_ID } },
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
    expect(prisma.whatsappAccount.findFirst).not.toHaveBeenCalled();
    expect(prisma.whatsappConversationMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: LIST_TENANT_ID,
          listLeadId: 42,
          listSendId: 9,
        }),
      }),
    );
  });

  it('sem context + phone_number_id dedicado amarrado persiste tenantId certo e listLeadId null', async () => {
    const { service, prisma } = build({
      dedicatedAccount: { id: DEDICATED_ACCOUNT_ID, isDefault: false },
      outreachConfig: { tenantId: DEDICATED_TENANT_ID },
    });

    const result = await service.handleInboundMessage(
      inboundText(),
      metadata(DEDICATED_PHONE_NUMBER_ID),
    );

    expect(prisma.whatsappAccount.findFirst).toHaveBeenCalledWith({
      where: { phoneNumberId: DEDICATED_PHONE_NUMBER_ID },
    });
    expect(prisma.tenantOutreachConfig.findUnique).toHaveBeenCalledWith({
      where: { whatsappAccountId: DEDICATED_ACCOUNT_ID },
    });
    expect(result.persisted).toBe(true);
    expect(result.correlation).toBe('dedicated_number');
    expect(result.tenantId).toBe(DEDICATED_TENANT_ID);
    expect(result.listLeadId).toBeNull();
    expect(prisma.whatsappConversationMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: DEDICATED_TENANT_ID,
          listLeadId: null,
          listSendId: null,
        }),
      }),
    );
  });

  it('sem context + número default não persiste nem chuta tenant', async () => {
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
    expect(prisma.tenantOutreachConfig.findUnique).not.toHaveBeenCalled();
    expect(prisma.whatsappConversationMessage.create).not.toHaveBeenCalled();
  });
});
