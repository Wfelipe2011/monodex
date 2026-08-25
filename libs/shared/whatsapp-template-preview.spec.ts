import { toTemplatePreviewDto } from './whatsapp-template-preview';

const BODY_COMPONENTS = [
  {
    type: 'BODY',
    text: 'Olá, {{1}} — temos uma indicação para o seu negócio.',
  },
  { type: 'FOOTER', text: 'Mensagem automática' },
];

describe('toTemplatePreviewDto', () => {
  it('devolve components persistidos e slots estáveis body.1', () => {
    const dto = toTemplatePreviewDto({
      id: 10,
      metaId: 'meta-10',
      name: 'welcome',
      language: 'pt_BR',
      status: 'APPROVED',
      category: 'MARKETING',
      parameterFormat: 'POSITIONAL',
      slots: [],
      components: BODY_COMPONENTS,
      lastSyncedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(dto.components).toBe(BODY_COMPONENTS);
    expect(dto.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'BODY',
          text: expect.stringContaining('{{1}}'),
        }),
      ]),
    );
    expect(dto.slots.map((s) => s.key)).toContain('body.1');
    expect(dto).toMatchObject({
      id: 10,
      metaId: 'meta-10',
      name: 'welcome',
      language: 'pt_BR',
      status: 'APPROVED',
      category: 'MARKETING',
      parameterFormat: 'POSITIONAL',
    });
  });

  it('reusa slots persistidos quando não vazios', () => {
    const persisted = [
      {
        key: 'body.1',
        component: 'body' as const,
        paramType: 'text' as const,
        format: 'positional' as const,
        index: 1,
      },
    ];
    const dto = toTemplatePreviewDto({
      id: 1,
      metaId: null,
      name: 'x',
      language: 'pt_BR',
      status: 'APPROVED',
      category: null,
      parameterFormat: null,
      slots: persisted,
      components: BODY_COMPONENTS,
      lastSyncedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(dto.slots).toBe(persisted);
  });
});
