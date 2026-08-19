import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GRAPH_API_VERSION } from './platform-whatsapp-admin.service';
import { ConversationsService } from './conversations.service';

const TENANT_DEDICATED = 7;
const TENANT_DEFAULT = 8;
const CONVERSATION_ID = 88;
const DEDICATED_PHONE = '999000111222';
const DEFAULT_PHONE = '1292251013966333';
const THREAD_PHONE = '5511999998888';

describe('ConversationsService', () => {
  const dedicatedCreds = {
    accountId: 2,
    wabaId: 'waba-shared',
    phoneNumberId: DEDICATED_PHONE,
    token: 'token-dedicated',
    messagesUrl: `https://graph.facebook.com/${GRAPH_API_VERSION}/${DEDICATED_PHONE}/messages`,
  };

  const defaultCreds = {
    accountId: 1,
    wabaId: 'waba-shared',
    phoneNumberId: DEFAULT_PHONE,
    token: 'token-default',
    messagesUrl: `https://graph.facebook.com/${GRAPH_API_VERSION}/${DEFAULT_PHONE}/messages`,
  };

  function build(opts?: {
    tenantId?: number;
    outreachConfig?: {
      whatsappAccountId: number | null;
      whatsappAccount: { isDefault: boolean } | null;
    } | null;
    lastInbound?: { id: number; direction: string; createdAt: Date } | null;
  }) {
    const tenantId = opts?.tenantId ?? TENANT_DEDICATED;
    const outreachConfig =
      opts && 'outreachConfig' in opts
        ? opts.outreachConfig
        : {
            whatsappAccountId: 2,
            whatsappAccount: { isDefault: false },
          };
    const lastInbound =
      opts && 'lastInbound' in opts
        ? opts.lastInbound
        : {
            id: 1,
            direction: 'IN',
            createdAt: new Date(),
          };

    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ id: tenantId }),
      },
      tenantOutreachConfig: {
        findUnique: jest.fn().mockResolvedValue(outreachConfig),
      },
      whatsappConversation: {
        findFirst: jest.fn().mockResolvedValue({
          id: CONVERSATION_ID,
          phone: THREAD_PHONE,
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({ id: CONVERSATION_ID }),
      },
      whatsappConversationMessage: {
        findFirst: jest.fn().mockResolvedValue(lastInbound),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({
          id: 99,
          wamid: 'wamid.out',
          direction: 'OUT',
          type: 'text',
          body: 'oi',
          createdAt: new Date(),
        }),
      },
    };
    const httpService = {
      axiosRef: {
        post: jest.fn().mockResolvedValue({
          data: { messages: [{ id: 'wamid.out' }] },
        }),
      },
    };
    const platformWhatsapp = {
      resolveCredentials: jest
        .fn()
        .mockImplementation(async (id?: number) =>
          id === TENANT_DEDICATED ? dedicatedCreds : defaultCreds,
        ),
    };
    const service = new ConversationsService(
      prisma as never,
      httpService as never,
      platformWhatsapp as never,
    );
    return { service, prisma, httpService, platformWhatsapp, tenantId };
  }

  it('Graph POST usa phoneNumberId da conta dedicada quando o tenant tem FK', async () => {
    const { service, httpService, platformWhatsapp, prisma } = build({
      tenantId: TENANT_DEDICATED,
    });

    await service.sendTextMessage(TENANT_DEDICATED, CONVERSATION_ID, {
      text: 'oi',
    });

    expect(platformWhatsapp.resolveCredentials).toHaveBeenCalledWith(
      TENANT_DEDICATED,
    );
    expect(httpService.axiosRef.post).toHaveBeenCalledWith(
      dedicatedCreds.messagesUrl,
      expect.objectContaining({ type: 'text', to: THREAD_PHONE }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${dedicatedCreds.token}`,
        }),
      }),
    );
    expect(dedicatedCreds.messagesUrl).toContain(DEDICATED_PHONE);
    expect(prisma.whatsappConversationMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          conversationId: CONVERSATION_ID,
          tenantId: TENANT_DEDICATED,
        }),
      }),
    );
    expect(prisma.whatsappConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CONVERSATION_ID },
        data: expect.objectContaining({ lastMessageAt: expect.any(Date) }),
      }),
    );
  });

  it('POST sem número dedicado (whatsappAccountId null) → 400 sem Graph', async () => {
    const { service, httpService, platformWhatsapp } = build({
      tenantId: TENANT_DEFAULT,
      outreachConfig: { whatsappAccountId: null, whatsappAccount: null },
    });

    await expect(
      service.sendTextMessage(TENANT_DEFAULT, CONVERSATION_ID, { text: 'oi' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(httpService.axiosRef.post).not.toHaveBeenCalled();
    expect(platformWhatsapp.resolveCredentials).not.toHaveBeenCalled();
  });

  it('POST com conta isDefault → 400 sem Graph', async () => {
    const { service, httpService, platformWhatsapp } = build({
      tenantId: TENANT_DEFAULT,
      outreachConfig: {
        whatsappAccountId: 1,
        whatsappAccount: { isDefault: true },
      },
    });

    await expect(
      service.sendTextMessage(TENANT_DEFAULT, CONVERSATION_ID, { text: 'oi' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(httpService.axiosRef.post).not.toHaveBeenCalled();
    expect(platformWhatsapp.resolveCredentials).not.toHaveBeenCalled();
  });

  it('não chama Graph fora da janela 24h', async () => {
    const { service, httpService, platformWhatsapp, prisma } = build({
      lastInbound: null,
    });

    await expect(
      service.sendTextMessage(TENANT_DEDICATED, CONVERSATION_ID, {
        text: 'oi',
      }),
    ).rejects.toMatchObject({
      constructor: BadRequestException,
      message: expect.stringContaining('OUTSIDE_MESSAGING_WINDOW'),
    });

    expect(prisma.whatsappConversationMessage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          conversationId: CONVERSATION_ID,
          direction: 'IN',
        }),
      }),
    );
    expect(httpService.axiosRef.post).not.toHaveBeenCalled();
    expect(platformWhatsapp.resolveCredentials).not.toHaveBeenCalled();
  });

  it('GET messages filtra conversationId + since', async () => {
    const { service, prisma } = build();
    const since = '2026-08-17T12:00:00.000Z';

    await service.listMessages(TENANT_DEDICATED, CONVERSATION_ID, since);

    expect(prisma.whatsappConversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CONVERSATION_ID, tenantId: TENANT_DEDICATED },
      }),
    );
    expect(prisma.whatsappConversationMessage.findMany).toHaveBeenCalledWith({
      where: {
        conversationId: CONVERSATION_ID,
        createdAt: { gt: new Date(since) },
      },
      select: expect.objectContaining({
        id: true,
        wamid: true,
        direction: true,
        type: true,
        body: true,
        createdAt: true,
      }),
      orderBy: { createdAt: 'asc' },
    });
  });

  it('GET lista threads ordena por lastMessageAt desc e não usa listId', async () => {
    const { service, prisma } = build();

    await service.listConversations(TENANT_DEDICATED);

    expect(prisma.whatsappConversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TENANT_DEDICATED },
        orderBy: { lastMessageAt: 'desc' },
      }),
    );
    const findManyArg = prisma.whatsappConversation.findMany.mock.calls[0][0];
    expect(findManyArg.where).not.toHaveProperty('listId');
  });

  it('GET lista threads 404 se tenant não existe', async () => {
    const { service, prisma } = build();
    prisma.tenant.findUnique.mockResolvedValue(null);

    await expect(service.listConversations(TENANT_DEDICATED)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.whatsappConversation.findMany).not.toHaveBeenCalled();
  });

  it('since inválido → 400', async () => {
    const { service, prisma } = build();

    await expect(
      service.listMessages(TENANT_DEDICATED, CONVERSATION_ID, 'not-iso'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.whatsappConversationMessage.findMany).not.toHaveBeenCalled();
  });
});
