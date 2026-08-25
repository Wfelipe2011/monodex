import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import axios from 'axios';
import { GRAPH_API_VERSION } from './platform-whatsapp-admin.service';
import { WhatsappTemplatesService } from './whatsapp-templates.service';

const DEFAULT_ACCOUNT_ID = 1;
const SECOND_ACCOUNT_ID = 2;
const WABA_ID = 'waba-shared';
const DEFAULT_PHONE = '1292251013966333';
const SECOND_PHONE = '999000111222';
const TEMPLATE_ID = 10;

const PREVIEW_COMPONENTS = [
  {
    type: 'BODY',
    text: 'Olá, {{1}} — temos uma indicação para o seu negócio.',
  },
];

const VALID_CREATE_COMPONENTS = [
  {
    type: 'BODY',
    text: 'Olá, {{1}} — oferta especial esta semana.',
    example: { body_text: [['Cliente']] },
  },
];

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

  const catalogRow = {
    id: TEMPLATE_ID,
    metaId: 'meta-10',
    name: 'welcome',
    language: 'pt_BR',
    status: 'APPROVED',
    category: 'MARKETING',
    parameterFormat: 'POSITIONAL',
    slots: [],
    components: PREVIEW_COMPONENTS,
    lastSyncedAt: new Date('2026-01-01T00:00:00.000Z'),
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
        upsert: jest.fn().mockResolvedValue({
          ...catalogRow,
          name: 'promo_boas_vindas',
          status: 'PENDING',
          metaId: 'meta-created',
          components: VALID_CREATE_COMPONENTS,
        }),
        update: jest.fn().mockResolvedValue({
          ...catalogRow,
          components: VALID_CREATE_COMPONENTS,
          status: 'PENDING',
        }),
        delete: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue(approvedTemplate),
        findMany: jest.fn().mockResolvedValue([catalogRow]),
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
        count: jest.fn().mockResolvedValue(0),
      },
      tenantTemplateGrant: {
        count: jest.fn().mockResolvedValue(0),
      },
      tenantListCampaign: {
        count: jest.fn().mockResolvedValue(0),
      },
      tenantOnDemandSend: {
        count: jest.fn().mockResolvedValue(0),
      },
      tenantOnDemandSchedule: {
        count: jest.fn().mockResolvedValue(0),
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
        delete: jest.fn().mockResolvedValue({ data: { success: true } }),
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

  it('list mapeia preview com components e slots body.1', async () => {
    const { service, httpService } = build();
    const result = await service.list({});

    expect(result).toHaveLength(1);
    expect(result[0].components).toEqual(PREVIEW_COMPONENTS);
    expect(result[0].slots.map((s) => s.key)).toContain('body.1');
    expect(result[0]).toMatchObject({
      id: TEMPLATE_ID,
      metaId: 'meta-10',
      name: 'welcome',
      category: 'MARKETING',
      parameterFormat: 'POSITIONAL',
    });
    expect(httpService.axiosRef.get).not.toHaveBeenCalled();
  });

  it('getById happy path retorna mesmo shape de preview', async () => {
    const { service, prisma, httpService } = build();
    prisma.whatsappMessageTemplate.findUnique.mockResolvedValue(catalogRow);

    const result = await service.getById(TEMPLATE_ID);

    expect(result.components).toEqual(PREVIEW_COMPONENTS);
    expect(result.slots.map((s) => s.key)).toContain('body.1');
    expect(result.metaId).toBe('meta-10');
    expect(httpService.axiosRef.get).not.toHaveBeenCalled();
  });

  it('getById id inexistente → 404 sem Graph', async () => {
    const { service, prisma, httpService } = build();
    prisma.whatsappMessageTemplate.findUnique.mockResolvedValue(null);

    await expect(service.getById(999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(httpService.axiosRef.get).not.toHaveBeenCalled();
    expect(httpService.axiosRef.post).not.toHaveBeenCalled();
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

  it('create MARKETING → Graph + upsert local com slots', async () => {
    const { service, prisma, httpService } = build();
    httpService.axiosRef.post.mockResolvedValue({
      data: { id: 'meta-created', status: 'PENDING', category: 'MARKETING' },
    });

    const result = await service.create({
      name: 'promo_boas_vindas',
      language: 'pt_BR',
      category: 'MARKETING',
      parameterFormat: 'POSITIONAL',
      components: VALID_CREATE_COMPONENTS,
    });

    expect(httpService.axiosRef.post).toHaveBeenCalledWith(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${WABA_ID}/message_templates`,
      expect.objectContaining({
        name: 'promo_boas_vindas',
        language: 'pt_BR',
        category: 'MARKETING',
        parameter_format: 'POSITIONAL',
        components: VALID_CREATE_COMPONENTS,
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-default',
        }),
      }),
    );
    expect(prisma.whatsappMessageTemplate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          whatsappAccountId_name_language: {
            whatsappAccountId: DEFAULT_ACCOUNT_ID,
            name: 'promo_boas_vindas',
            language: 'pt_BR',
          },
        },
        create: expect.objectContaining({
          metaId: 'meta-created',
          status: 'PENDING',
          category: 'MARKETING',
        }),
      }),
    );
    expect(result.name).toBe('promo_boas_vindas');
    expect(result.slots.map((s) => s.key)).toContain('body.1');
  });

  it('create category ≠ MARKETING → 400 sem Graph', async () => {
    const { service, prisma, httpService } = build();

    await expect(
      service.create({
        name: 'promo_util',
        language: 'pt_BR',
        category: 'UTILITY' as 'MARKETING',
        components: VALID_CREATE_COMPONENTS,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(httpService.axiosRef.post).not.toHaveBeenCalled();
    expect(prisma.whatsappMessageTemplate.upsert).not.toHaveBeenCalled();
  });

  it('create HEADER IMAGE sem handle → 400 sem Graph nem upsert', async () => {
    const { service, prisma, httpService } = build();

    await expect(
      service.create({
        name: 'promo_imagem',
        language: 'pt_BR',
        category: 'MARKETING',
        components: [
          {
            type: 'HEADER',
            format: 'IMAGE',
          },
          {
            type: 'BODY',
            text: 'Olá sem variável',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(httpService.axiosRef.post).not.toHaveBeenCalled();
    expect(prisma.whatsappMessageTemplate.upsert).not.toHaveBeenCalled();
  });

  it('create com erro Graph 4xx → 400 e sem upsert', async () => {
    const { service, prisma, httpService } = build();
    const graphError = new axios.AxiosError('Request failed');
    graphError.response = {
      status: 400,
      data: { error: { message: 'Invalid template' } },
      statusText: 'Bad Request',
      headers: {},
      config: {} as never,
    };
    httpService.axiosRef.post.mockRejectedValue(graphError);

    await expect(
      service.create({
        name: 'promo_fail',
        language: 'pt_BR',
        category: 'MARKETING',
        components: VALID_CREATE_COMPONENTS,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.whatsappMessageTemplate.upsert).not.toHaveBeenCalled();
  });

  it('patch atualiza local só após Graph OK', async () => {
    const { service, prisma, httpService } = build();
    prisma.whatsappMessageTemplate.findUnique.mockResolvedValue(catalogRow);
    httpService.axiosRef.post.mockResolvedValue({
      data: { id: 'meta-10', status: 'PENDING' },
    });

    const patchedBody = [
      {
        type: 'BODY',
        text: 'Novo texto {{1}}',
        example: { body_text: [['X']] },
      },
    ];
    await service.patch(TEMPLATE_ID, { components: patchedBody });

    expect(httpService.axiosRef.post).toHaveBeenCalledWith(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/meta-10`,
      expect.objectContaining({ components: patchedBody }),
      expect.any(Object),
    );
    expect(prisma.whatsappMessageTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEMPLATE_ID },
        data: expect.objectContaining({
          components: patchedBody,
          status: 'PENDING',
        }),
      }),
    );
  });

  it('patch com metaId null → 400 sem Graph', async () => {
    const { service, prisma, httpService } = build();
    prisma.whatsappMessageTemplate.findUnique.mockResolvedValue({
      ...catalogRow,
      metaId: null,
    });

    await expect(
      service.patch(TEMPLATE_ID, { components: VALID_CREATE_COMPONENTS }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(httpService.axiosRef.post).not.toHaveBeenCalled();
    expect(prisma.whatsappMessageTemplate.update).not.toHaveBeenCalled();
  });

  it('patch com falha Graph → não atualiza local', async () => {
    const { service, prisma, httpService } = build();
    prisma.whatsappMessageTemplate.findUnique.mockResolvedValue(catalogRow);
    const graphError = new axios.AxiosError('Request failed');
    graphError.response = {
      status: 400,
      data: { error: { message: 'Edit limit reached' } },
      statusText: 'Bad Request',
      headers: {},
      config: {} as never,
    };
    httpService.axiosRef.post.mockRejectedValue(graphError);

    await expect(
      service.patch(TEMPLATE_ID, { components: VALID_CREATE_COMPONENTS }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.whatsappMessageTemplate.update).not.toHaveBeenCalled();
  });

  it('delete com grant → 409 e row permanece', async () => {
    const { service, prisma, httpService } = build();
    prisma.whatsappMessageTemplate.findUnique.mockResolvedValue(catalogRow);
    prisma.tenantTemplateGrant.count.mockResolvedValue(1);

    await expect(service.delete(TEMPLATE_ID)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(httpService.axiosRef.delete).not.toHaveBeenCalled();
    expect(prisma.whatsappMessageTemplate.delete).not.toHaveBeenCalled();
  });

  it('delete sem FKs + Graph OK → remove row', async () => {
    const { service, prisma, httpService } = build();
    prisma.whatsappMessageTemplate.findUnique.mockResolvedValue(catalogRow);

    const result = await service.delete(TEMPLATE_ID);

    expect(httpService.axiosRef.delete).toHaveBeenCalledWith(
      expect.stringContaining(
        `/${WABA_ID}/message_templates?name=welcome&hsm_id=meta-10`,
      ),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-default',
        }),
      }),
    );
    expect(prisma.whatsappMessageTemplate.delete).toHaveBeenCalledWith({
      where: { id: TEMPLATE_ID },
    });
    expect(result).toEqual({ deleted: true, id: TEMPLATE_ID });
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
