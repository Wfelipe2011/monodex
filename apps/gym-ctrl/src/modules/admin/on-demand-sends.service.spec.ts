import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { OnDemandSendSource } from '@prisma/client';
import { GRAPH_API_VERSION } from './platform-whatsapp-admin.service';
import { OnDemandSendsService } from './on-demand-sends.service';

const TENANT_ID = 4;
const TEMPLATE_ID = 10;
const DEDICATED_PHONE = '999000111222';

describe('OnDemandSendsService', () => {
  const dedicatedCreds = {
    accountId: 2,
    wabaId: 'waba-shared',
    phoneNumberId: DEDICATED_PHONE,
    token: 'token-dedicated',
    messagesUrl: `https://graph.facebook.com/${GRAPH_API_VERSION}/${DEDICATED_PHONE}/messages`,
  };

  const approvedTemplate = {
    id: TEMPLATE_ID,
    name: 'hello',
    language: 'pt_BR',
    status: 'APPROVED',
    slots: [{ key: 'body.1', component: 'body', paramType: 'text', index: 1 }],
    components: [],
  };

  function build(opts?: {
    outreach?: {
      costPerOnDemandSend: number;
      costPerLead: number;
      whatsappAccountId: number | null;
      whatsappAccount: { isDefault: boolean } | null;
    } | null;
    grant?: { template: typeof approvedTemplate } | null;
    balance?: number;
    media?: { id: number; publicId: string } | null;
    slotsOverride?: typeof approvedTemplate.slots;
  }) {
    const outreach =
      opts && 'outreach' in opts
        ? opts.outreach
        : {
            costPerOnDemandSend: 5,
            costPerLead: 10,
            whatsappAccountId: 2,
            whatsappAccount: { isDefault: false },
          };

    const grant =
      opts && 'grant' in opts
        ? opts.grant
        : {
            template: {
              ...approvedTemplate,
              slots: opts?.slotsOverride ?? approvedTemplate.slots,
            },
          };

    const coinUpdate = jest.fn();
    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ id: TENANT_ID }),
      },
      tenantOutreachConfig: {
        findUnique: jest.fn().mockResolvedValue(outreach),
      },
      tenantTemplateGrant: {
        findUnique: jest.fn().mockResolvedValue(grant),
      },
      lead: {
        findUnique: jest.fn(),
      },
      coin: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ balance: opts?.balance ?? 100, userId: 1 }),
        update: coinUpdate,
      },
      tenantLead: {
        count: jest.fn().mockResolvedValue(0),
      },
      tenantOnDemandSend: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({
          id: 55,
          wamid: 'wamid.od.1',
          phone: '5511999998888',
          templateId: TEMPLATE_ID,
          conversationId: 77,
          coinDebitedAt: null,
          sentAt: new Date(),
        }),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
      },
      tenantLeadList: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      tenantListSend: {
        count: jest.fn().mockResolvedValue(0),
      },
      whatsappConversation: {
        upsert: jest.fn().mockResolvedValue({ id: 77 }),
      },
      whatsappConversationMessage: {
        create: jest.fn().mockResolvedValue({ id: 1 }),
      },
    };

    const httpService = {
      axiosRef: {
        post: jest.fn().mockResolvedValue({
          data: {
            messages: [{ id: 'wamid.od.1', message_status: 'accepted' }],
          },
        }),
      },
    };

    const platformWhatsapp = {
      resolveCredentials: jest.fn().mockResolvedValue(dedicatedCreds),
    };

    const mediaOwned =
      opts && 'media' in opts
        ? opts.media
        : { id: 3, publicId: 'img-public-1' };

    const mediaService = {
      findOwnedByPublicId: jest.fn().mockResolvedValue(mediaOwned),
      publicUrl: jest.fn((id: string) => `https://api.example/public/media/${id}`),
    };

    const service = new OnDemandSendsService(
      prisma as never,
      httpService as never,
      platformWhatsapp as never,
      mediaService as never,
    );

    return {
      service,
      prisma,
      httpService,
      platformWhatsapp,
      mediaService,
      coinUpdate,
    };
  }

  it('happy path: Graph no dedicado, persiste send sem débito e thread', async () => {
    const { service, httpService, platformWhatsapp, prisma, coinUpdate } =
      build();

    const result = await service.create(
      TENANT_ID,
      TEMPLATE_ID,
      { to: '11999998888', variables: { 'body.1': 'João' } },
      { authKind: 'jwt' },
    );

    expect(platformWhatsapp.resolveCredentials).toHaveBeenCalledWith(TENANT_ID);
    expect(httpService.axiosRef.post).toHaveBeenCalledWith(
      dedicatedCreds.messagesUrl,
      expect.objectContaining({
        to: expect.stringMatching(/^55/),
        type: 'template',
      }),
      expect.any(Object),
    );
    expect(prisma.tenantOnDemandSend.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: TENANT_ID,
          templateId: TEMPLATE_ID,
          wamid: 'wamid.od.1',
          coinDebitedAt: null,
          source: OnDemandSendSource.ADMIN_JWT,
          conversationId: 77,
        }),
      }),
    );
    expect(prisma.whatsappConversationMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          wamid: 'wamid.od.1',
          type: 'template',
          direction: 'OUT',
          conversationId: 77,
        }),
      }),
    );
    expect(coinUpdate).not.toHaveBeenCalled();
    expect(prisma.coin.update).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      id: 55,
      wamid: 'wamid.od.1',
      conversationId: 77,
      messageStatus: 'accepted',
    });
  });

  it('API key grava source=API_KEY e apiKeyId', async () => {
    const { service, prisma } = build();

    await service.create(
      TENANT_ID,
      TEMPLATE_ID,
      { to: '11999998888', variables: { 'body.1': 'X' } },
      { authKind: 'api_key', apiKeyId: 9 },
    );

    expect(prisma.tenantOnDemandSend.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: OnDemandSendSource.API_KEY,
          apiKeyId: 9,
        }),
      }),
    );
  });

  it('sem dedicado → 400 sem Graph', async () => {
    const { service, httpService, platformWhatsapp } = build({
      outreach: {
        costPerOnDemandSend: 5,
        costPerLead: 10,
        whatsappAccountId: null,
        whatsappAccount: null,
      },
    });

    await expect(
      service.create(
        TENANT_ID,
        TEMPLATE_ID,
        { to: '11999998888', variables: { 'body.1': 'X' } },
        { authKind: 'jwt' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(httpService.axiosRef.post).not.toHaveBeenCalled();
    expect(platformWhatsapp.resolveCredentials).not.toHaveBeenCalled();
  });

  it('conta isDefault (número compartilhado) → 400 sem Graph', async () => {
    const { service, httpService, platformWhatsapp } = build({
      outreach: {
        costPerOnDemandSend: 5,
        costPerLead: 10,
        whatsappAccountId: 1,
        whatsappAccount: { isDefault: true },
      },
    });

    await expect(
      service.create(
        TENANT_ID,
        TEMPLATE_ID,
        { to: '11999998888', variables: { 'body.1': 'X' } },
        { authKind: 'jwt' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(httpService.axiosRef.post).not.toHaveBeenCalled();
    expect(platformWhatsapp.resolveCredentials).not.toHaveBeenCalled();
  });

  it('template ungranted → 404 sem Graph', async () => {
    const { service, httpService } = build({ grant: null });

    await expect(
      service.create(
        TENANT_ID,
        TEMPLATE_ID,
        { to: '11999998888', variables: { 'body.1': 'X' } },
        { authKind: 'jwt' },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(httpService.axiosRef.post).not.toHaveBeenCalled();
  });

  it('template não APPROVED → 400 sem Graph', async () => {
    const { service, httpService } = build({
      grant: {
        template: { ...approvedTemplate, status: 'PENDING' },
      },
    });

    await expect(
      service.create(
        TENANT_ID,
        TEMPLATE_ID,
        { to: '11999998888', variables: { 'body.1': 'X' } },
        { authKind: 'jwt' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(httpService.axiosRef.post).not.toHaveBeenCalled();
  });

  it('preço 0 → 400 sem Graph', async () => {
    const { service, httpService, platformWhatsapp } = build({
      outreach: {
        costPerOnDemandSend: 0,
        costPerLead: 10,
        whatsappAccountId: 2,
        whatsappAccount: { isDefault: false },
      },
    });

    await expect(
      service.create(
        TENANT_ID,
        TEMPLATE_ID,
        { to: '11999998888', variables: { 'body.1': 'X' } },
        { authKind: 'jwt' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(httpService.axiosRef.post).not.toHaveBeenCalled();
    expect(platformWhatsapp.resolveCredentials).not.toHaveBeenCalled();
  });

  it('header.image sem imageId → 400 sem Graph', async () => {
    const { service, httpService } = build({
      slotsOverride: [
        {
          key: 'header.image',
          component: 'header',
          paramType: 'image',
        },
        { key: 'body.1', component: 'body', paramType: 'text', index: 1 },
      ] as never,
    });

    await expect(
      service.create(
        TENANT_ID,
        TEMPLATE_ID,
        { to: '11999998888', variables: { 'body.1': 'X' } },
        { authKind: 'jwt' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(httpService.axiosRef.post).not.toHaveBeenCalled();
  });

  it('imageId de outro tenant → 404 sem Graph', async () => {
    const { service, httpService, mediaService } = build({
      media: null,
      slotsOverride: [
        {
          key: 'header.image',
          component: 'header',
          paramType: 'image',
        },
      ] as never,
    });

    await expect(
      service.create(
        TENANT_ID,
        TEMPLATE_ID,
        { to: '11999998888', imageId: 'foreign-id' },
        { authKind: 'jwt' },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(mediaService.findOwnedByPublicId).toHaveBeenCalledWith(
      TENANT_ID,
      'foreign-id',
    );
    expect(httpService.axiosRef.post).not.toHaveBeenCalled();
  });

  it('saldo insuficiente → 400 sem Graph', async () => {
    const { service, httpService } = build({ balance: 1 });

    await expect(
      service.create(
        TENANT_ID,
        TEMPLATE_ID,
        { to: '11999998888', variables: { 'body.1': 'X' } },
        { authKind: 'jwt' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(httpService.axiosRef.post).not.toHaveBeenCalled();
  });

  it('Graph 200 não chama coin.update', async () => {
    const { service, prisma, coinUpdate } = build();

    await service.create(
      TENANT_ID,
      TEMPLATE_ID,
      { to: '11999998888', variables: { 'body.1': 'X' } },
      { authKind: 'jwt' },
    );

    expect(coinUpdate).not.toHaveBeenCalled();
    expect(prisma.coin.update).not.toHaveBeenCalled();
    expect(prisma.tenantOnDemandSend.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ coinDebitedAt: null }),
      }),
    );
  });

  it('GET by id de outro tenant → 404', async () => {
    const { service, prisma } = build();
    prisma.tenantOnDemandSend.findFirst.mockResolvedValue(null);

    await expect(service.getById(TENANT_ID, 999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
