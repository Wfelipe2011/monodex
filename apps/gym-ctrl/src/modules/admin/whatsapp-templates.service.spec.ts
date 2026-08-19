import { BadRequestException } from '@nestjs/common';
import { GRAPH_API_VERSION } from './platform-whatsapp-admin.service';
import { WhatsappTemplatesService } from './whatsapp-templates.service';

const DEFAULT_ACCOUNT_ID = 1;
const SECOND_ACCOUNT_ID = 2;
const WABA_ID = 'waba-shared';
const DEFAULT_PHONE = '1292251013966333';
const SECOND_PHONE = '999000111222';
const TEMPLATE_ID = 10;

describe('WhatsappTemplatesService', () => {
  const defaultCreds = {
    accountId: DEFAULT_ACCOUNT_ID,
    wabaId: WABA_ID,
    phoneNumberId: DEFAULT_PHONE,
    token: 'token-default',
    messagesUrl: `https://graph.facebook.com/${GRAPH_API_VERSION}/${DEFAULT_PHONE}/messages`,
  };

  const approvedTemplate = {
    id: TEMPLATE_ID,
    name: 'test_gladson',
    language: 'pt_BR',
    status: 'APPROVED',
    slots: [],
    components: [],
  };

  function build(overrides?: {
    graphTemplates?: Array<{
      id?: string;
      name?: string;
      language?: string;
      status?: string;
    }>;
    account?: Record<string, unknown> | null;
  }) {
    const prisma = {
      whatsappMessageTemplate: {
        upsert: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue(approvedTemplate),
      },
      whatsappAccount: {
        findUnique: jest.fn().mockResolvedValue(
          overrides?.account === undefined
            ? {
                id: SECOND_ACCOUNT_ID,
                tenantId: null,
                enabled: true,
                wabaId: WABA_ID,
                phoneNumberId: SECOND_PHONE,
                tokenEnvKey: 'WA_TOKEN_SECOND',
              }
            : overrides.account,
        ),
      },
      lead: { findUnique: jest.fn() },
      tenantOutreachConfig: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      whatsappConversation: {
        upsert: jest.fn().mockResolvedValue({ id: 77 }),
      },
      whatsappConversationMessage: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const httpService = {
      axiosRef: {
        get: jest.fn().mockResolvedValue({
          data: {
            data: overrides?.graphTemplates ?? [
              {
                id: 'meta-1',
                name: 'test_gladson',
                language: 'pt_BR',
                status: 'APPROVED',
                components: [],
              },
            ],
          },
        }),
        post: jest.fn().mockResolvedValue({
          data: { messages: [{ id: 'wamid.1', message_status: 'accepted' }] },
        }),
      },
    };
    const platformWhatsapp = {
      resolveCredentials: jest.fn().mockResolvedValue(defaultCreds),
    };
    const service = new WhatsappTemplatesService(
      prisma as never,
      httpService as never,
      platformWhatsapp as never,
    );
    return { service, prisma, httpService, platformWhatsapp };
  }

  afterEach(() => {
    delete process.env.WA_TOKEN_SECOND;
  });

  it('sync upserta templates só na conta default, mesmo com segundo número no WABA', async () => {
    const { service, prisma, platformWhatsapp } = build();
    const result = await service.sync();

    expect(platformWhatsapp.resolveCredentials).toHaveBeenCalledWith();
    expect(prisma.whatsappMessageTemplate.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.whatsappMessageTemplate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          whatsappAccountId_name_language: {
            whatsappAccountId: DEFAULT_ACCOUNT_ID,
            name: 'test_gladson',
            language: 'pt_BR',
          },
        },
        create: expect.objectContaining({
          whatsappAccountId: DEFAULT_ACCOUNT_ID,
        }),
      }),
    );
    expect(prisma.whatsappAccount.findUnique).not.toHaveBeenCalled();
    expect(result).toEqual({
      upserted: 1,
      accountId: DEFAULT_ACCOUNT_ID,
    });
  });

  it('test-send sem whatsappAccountId POST Graph no phoneNumberId default', async () => {
    const { service, httpService, prisma } = build();
    const result = await service.testSend(TEMPLATE_ID, { to: '11999999999' });

    expect(prisma.whatsappAccount.findUnique).not.toHaveBeenCalled();
    expect(httpService.axiosRef.post).toHaveBeenCalledWith(
      defaultCreds.messagesUrl,
      expect.objectContaining({ to: '5511999999999' }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-default',
        }),
      }),
    );
    expect(result).toEqual({
      wamid: 'wamid.1',
      to: '5511999999999',
      messageStatus: 'accepted',
    });
    expect(prisma.whatsappConversation.upsert).not.toHaveBeenCalled();
    expect(prisma.whatsappConversationMessage.create).not.toHaveBeenCalled();
  });

  it('test-send com whatsappAccountId do segundo número POST nesse phoneNumberId', async () => {
    process.env.WA_TOKEN_SECOND = 'token-second';
    const { service, httpService, prisma } = build();
    await service.testSend(TEMPLATE_ID, {
      to: '11999999999',
      whatsappAccountId: SECOND_ACCOUNT_ID,
    });

    expect(prisma.whatsappAccount.findUnique).toHaveBeenCalledWith({
      where: { id: SECOND_ACCOUNT_ID },
    });
    expect(httpService.axiosRef.post).toHaveBeenCalledWith(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${SECOND_PHONE}/messages`,
      expect.objectContaining({ to: '5511999999999' }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-second',
        }),
      }),
    );
    expect(prisma.whatsappConversation.upsert).not.toHaveBeenCalled();
    expect(prisma.whatsappConversationMessage.create).not.toHaveBeenCalled();
  });

  it('test-send em conta dedicada amarrada grava thread OUT template', async () => {
    process.env.WA_TOKEN_SECOND = 'token-second';
    const { service, prisma } = build();
    prisma.tenantOutreachConfig.findUnique.mockResolvedValue({
      tenantId: 4,
      whatsappAccount: { isDefault: false },
    });

    const result = await service.testSend(TEMPLATE_ID, {
      to: '11999999999',
      whatsappAccountId: SECOND_ACCOUNT_ID,
    });

    expect(result).toEqual({
      wamid: 'wamid.1',
      to: '5511999999999',
      messageStatus: 'accepted',
    });
    expect(prisma.whatsappConversation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_phone: { tenantId: 4, phone: '5511999999999' },
        },
        create: expect.objectContaining({
          tenantId: 4,
          phone: '5511999999999',
          displayName: '5511999999999',
        }),
      }),
    );
    expect(prisma.whatsappConversationMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        wamid: 'wamid.1',
        direction: 'OUT',
        type: 'template',
        body: 'test_gladson',
        phone: '5511999999999',
        tenantId: 4,
        conversationId: 77,
      }),
    });
  });

  it('test-send com id inexistente → 400 e não chama Graph', async () => {
    const { service, httpService } = build({ account: null });
    await expect(
      service.testSend(TEMPLATE_ID, {
        to: '11999999999',
        whatsappAccountId: 999,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(httpService.axiosRef.post).not.toHaveBeenCalled();
  });

  it('test-send com conta disabled → 400 e não chama Graph', async () => {
    const { service, httpService } = build({
      account: {
        id: SECOND_ACCOUNT_ID,
        tenantId: null,
        enabled: false,
        wabaId: WABA_ID,
        phoneNumberId: SECOND_PHONE,
        tokenEnvKey: 'WA_TOKEN_SECOND',
      },
    });
    await expect(
      service.testSend(TEMPLATE_ID, {
        to: '11999999999',
        whatsappAccountId: SECOND_ACCOUNT_ID,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(httpService.axiosRef.post).not.toHaveBeenCalled();
  });
});
