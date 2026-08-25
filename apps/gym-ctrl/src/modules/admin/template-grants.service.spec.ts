import { NotFoundException } from '@nestjs/common';
import { TemplateGrantsService } from './template-grants.service';

const TENANT_ID = 4;
const TEMPLATE_ID = 10;

const PREVIEW_COMPONENTS = [
  {
    type: 'BODY',
    text: 'Olá, {{1}} — temos uma indicação para o seu negócio.',
  },
];

const catalogTemplate = {
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

describe('TemplateGrantsService — preview grant-filtered', () => {
  function build() {
    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ id: TENANT_ID }),
      },
      tenantTemplateGrant: {
        findMany: jest.fn().mockResolvedValue([
          { templateId: TEMPLATE_ID, template: catalogTemplate },
        ]),
        findUnique: jest.fn(),
      },
      whatsappMessageTemplate: {
        findUnique: jest.fn(),
      },
    };
    const service = new TemplateGrantsService(prisma as never);
    return { service, prisma };
  }

  it('listGrantedTemplates inclui components e slots body.1', async () => {
    const { service } = build();
    const result = await service.listGrantedTemplates(TENANT_ID);

    expect(result).toHaveLength(1);
    expect(result[0].components).toEqual(PREVIEW_COMPONENTS);
    expect(
      (result[0].components as { type: string; text?: string }[]).find(
        (c) => c.type === 'BODY',
      )?.text,
    ).toContain('{{1}}');
    expect(result[0].slots.map((s) => s.key)).toContain('body.1');
    expect(result[0]).toMatchObject({
      id: TEMPLATE_ID,
      metaId: 'meta-10',
      category: 'MARKETING',
      parameterFormat: 'POSITIONAL',
    });
  });

  it('getGrantedTemplate happy path', async () => {
    const { service, prisma } = build();
    prisma.tenantTemplateGrant.findUnique.mockResolvedValue({
      templateId: TEMPLATE_ID,
      template: catalogTemplate,
    });

    const result = await service.getGrantedTemplate(TENANT_ID, TEMPLATE_ID);

    expect(result.components).toEqual(PREVIEW_COMPONENTS);
    expect(result.slots.map((s) => s.key)).toContain('body.1');
  });

  it('getGrantedTemplate sem grant → 404', async () => {
    const { service, prisma } = build();
    prisma.tenantTemplateGrant.findUnique.mockResolvedValue(null);

    await expect(
      service.getGrantedTemplate(TENANT_ID, 11),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
