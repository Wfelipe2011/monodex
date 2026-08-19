import { GRAPH_API_VERSION } from './platform-whatsapp-admin.service';
import { ListConversationsService } from './list-conversations.service';

const TENANT_DEDICATED = 7;
const TENANT_DEFAULT = 8;
const LIST_ID = 1;
const LEAD_ID = 42;
const DEDICATED_PHONE = '999000111222';
const DEFAULT_PHONE = '1292251013966333';

describe('ListConversationsService', () => {
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

  function build(tenantId: number) {
    const prisma = {
      whatsappConversationMessage: {
        findFirst: jest.fn().mockResolvedValue({
          id: 1,
          direction: 'IN',
          createdAt: new Date(),
        }),
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
    const leadListsService = {
      getLead: jest.fn().mockResolvedValue({
        id: LEAD_ID,
        phone: '11999998888',
      }),
    };
    const platformWhatsapp = {
      resolveCredentials: jest
        .fn()
        .mockImplementation(async (id?: number) =>
          id === TENANT_DEDICATED ? dedicatedCreds : defaultCreds,
        ),
    };
    const service = new ListConversationsService(
      prisma as never,
      httpService as never,
      leadListsService as never,
      platformWhatsapp as never,
    );
    return { service, prisma, httpService, platformWhatsapp, tenantId };
  }

  it('Graph POST usa phoneNumberId da conta dedicada quando o tenant tem FK', async () => {
    const { service, httpService, platformWhatsapp } =
      build(TENANT_DEDICATED);

    await service.sendTextMessage(TENANT_DEDICATED, LIST_ID, LEAD_ID, {
      text: 'oi',
    });

    expect(platformWhatsapp.resolveCredentials).toHaveBeenCalledWith(
      TENANT_DEDICATED,
    );
    expect(httpService.axiosRef.post).toHaveBeenCalledWith(
      dedicatedCreds.messagesUrl,
      expect.objectContaining({ type: 'text' }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${dedicatedCreds.token}`,
        }),
      }),
    );
    expect(dedicatedCreds.messagesUrl).toContain(DEDICATED_PHONE);
  });

  it('tenant sem FK usa a conta default', async () => {
    const { service, httpService, platformWhatsapp } = build(TENANT_DEFAULT);

    await service.sendTextMessage(TENANT_DEFAULT, LIST_ID, LEAD_ID, {
      text: 'oi',
    });

    expect(platformWhatsapp.resolveCredentials).toHaveBeenCalledWith(
      TENANT_DEFAULT,
    );
    expect(httpService.axiosRef.post).toHaveBeenCalledWith(
      defaultCreds.messagesUrl,
      expect.objectContaining({ type: 'text' }),
      expect.any(Object),
    );
    expect(defaultCreds.messagesUrl).toContain(DEFAULT_PHONE);
    expect(defaultCreds.messagesUrl).not.toContain(DEDICATED_PHONE);
  });
});
