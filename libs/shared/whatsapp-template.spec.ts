import {
  extractQuickReplyButtons,
  normalizeCategoryKey,
  normalizeListPhone,
} from './list-campaign-helpers';
import { resolveBindingValue } from './whatsapp-template-bindings';
import {
  buildTemplateComponents,
  buildTemplateSendBody,
} from './whatsapp-template-payload';
import { parseTemplateSlots } from './whatsapp-template-slots';

const POSITIONAL_COMPONENTS = [
  { type: 'HEADER', format: 'IMAGE' },
  {
    type: 'BODY',
    text: 'Olá, {{1}} — temos uma indicação para o seu negócio.',
  },
  { type: 'FOOTER', text: 'Mensagem automática' },
];

const NAMED_COMPONENTS = [
  {
    type: 'BODY',
    text: 'O lead {{customer_name}} pediu contato.',
    example: {
      body_text_named_params: [
        { param_name: 'customer_name', example: 'Maria' },
      ],
    },
  },
  {
    type: 'BUTTONS',
    buttons: [
      {
        type: 'URL',
        text: 'WhatsApp',
        url: 'https://wa.me/{{1}}',
      },
    ],
  },
];

describe('parseTemplateSlots', () => {
  it('POSITIONAL: header image + {{1}} → header.image e body.1', () => {
    const slots = parseTemplateSlots(POSITIONAL_COMPONENTS);
    const keys = slots.map((s) => s.key);
    expect(keys).toEqual(['header.image', 'body.1']);
    expect(slots.find((s) => s.key === 'header.image')?.paramType).toBe('image');
    expect(slots.find((s) => s.key === 'body.1')).toMatchObject({
      format: 'positional',
      index: 1,
      paramType: 'text',
    });
  });

  it('NAMED: customer_name + button URL index 0', () => {
    const slots = parseTemplateSlots(NAMED_COMPONENTS);
    const keys = slots.map((s) => s.key);
    expect(keys).toEqual(['body.customer_name', 'button.0.url']);
    expect(slots.find((s) => s.key === 'body.customer_name')).toMatchObject({
      format: 'named',
      parameterName: 'customer_name',
    });
    expect(slots.find((s) => s.key === 'button.0.url')).toMatchObject({
      index: 0,
      subType: 'url',
    });
  });
});

describe('resolveBindingValue', () => {
  it('rating null → —', () => {
    expect(
      resolveBindingValue({ type: 'lead.rating' }, { lead: { rating: null } }),
    ).toBe('—');
  });

  it('phone 11999 recebe prefixo 55', () => {
    expect(
      resolveBindingValue({ type: 'lead.phone' }, { lead: { phone: '11999' } }),
    ).toBe('5511999');
  });

  it('now.date com clock fixo em SP formata dd/MM/yyyy', () => {
    const now = new Date('2026-08-16T02:30:00.000Z');
    expect(resolveBindingValue({ type: 'now.date' }, { now })).toBe('15/08/2026');
  });

  it('rejeita type fora do enum', () => {
    expect(() => resolveBindingValue({ type: 'lead.email' }, {})).toThrow(
      /Unknown binding type/,
    );
  });

  it('recipient.name resolve nome do lead de lista', () => {
    expect(
      resolveBindingValue(
        { type: 'recipient.name' },
        { recipient: { name: 'Ana' } },
      ),
    ).toBe('Ana');
  });

  it('recipient.phone recebe prefixo 55', () => {
    expect(
      resolveBindingValue(
        { type: 'recipient.phone' },
        { recipient: { phone: '11987654321' } },
      ),
    ).toBe('5511987654321');
  });

  it('recipient.category ausente → —', () => {
    expect(
      resolveBindingValue(
        { type: 'recipient.category' },
        { recipient: { category: null } },
      ),
    ).toBe('—');
  });

  it('recipient.reviews formata em pt-BR', () => {
    expect(
      resolveBindingValue(
        { type: 'recipient.reviews' },
        { recipient: { reviews: 4.5 } },
      ),
    ).toBe('4,5');
  });
});

const LIST_CAMPAIGN_COMPONENTS = [
  {
    type: 'BODY',
    text: 'Olá {{1}}, temos uma oportunidade para você.',
  },
  {
    type: 'BUTTONS',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Tenho Interesse!' },
      { type: 'QUICK_REPLY', text: 'Agora não' },
      { type: 'URL', text: 'Site', url: 'https://example.com' },
    ],
  },
];

describe('list-campaign-helpers', () => {
  it('normalizeListPhone: dígitos only e prefixo 55', () => {
    expect(normalizeListPhone('(11) 98765-4321')).toBe('5511987654321');
    expect(normalizeListPhone('5511999887766')).toBe('5511999887766');
    expect(normalizeListPhone('')).toBe('');
  });

  it('normalizeCategoryKey: lower case e remove acentos', () => {
    expect(normalizeCategoryKey('  Clínicas  ')).toBe('clinicas');
    expect(normalizeCategoryKey('Restaurantes')).toBe('restaurantes');
  });

  it('extractQuickReplyButtons retorna labels QUICK_REPLY com index', () => {
    expect(extractQuickReplyButtons(LIST_CAMPAIGN_COMPONENTS)).toEqual([
      { index: 0, label: 'Tenho Interesse!' },
      { index: 1, label: 'Agora não' },
    ]);
  });
});

describe('buildTemplateComponents', () => {
  it('POSITIONAL não inclui parameter_name', () => {
    const slots = parseTemplateSlots(POSITIONAL_COMPONENTS);
    const components = buildTemplateComponents(slots, {
      'header.image': 'https://cdn.example/h.png',
      'body.1': 'Gladson',
    });
    const body = components.find((c) => c.type === 'body') as {
      parameters: Array<Record<string, unknown>>;
    };
    expect(body.parameters[0]).toEqual({ type: 'text', text: 'Gladson' });
    expect(body.parameters[0]).not.toHaveProperty('parameter_name');
  });

  it('NAMED inclui parameter_name', () => {
    const slots = parseTemplateSlots(NAMED_COMPONENTS);
    const components = buildTemplateComponents(slots, {
      'body.customer_name': 'Maria',
      'button.0.url': '5511999',
    });
    const body = components.find((c) => c.type === 'body') as {
      parameters: Array<Record<string, unknown>>;
    };
    expect(body.parameters[0]).toEqual({
      type: 'text',
      parameter_name: 'customer_name',
      text: 'Maria',
    });
  });

  it('botão URL usa sub_type url e index string', () => {
    const slots = parseTemplateSlots(NAMED_COMPONENTS);
    const components = buildTemplateComponents(slots, {
      'body.customer_name': 'Maria',
      'button.0.url': '5511999',
    });
    const button = components.find((c) => c.type === 'button');
    expect(button).toMatchObject({
      type: 'button',
      sub_type: 'url',
      index: '0',
    });
    expect(typeof (button as { index: string }).index).toBe('string');
  });

  it('buildTemplateSendBody não hardcoda language e não inclui to', () => {
    const slots = parseTemplateSlots(POSITIONAL_COMPONENTS);
    const body = buildTemplateSendBody({
      name: 'test_gladson',
      language: 'en',
      slots,
      values: { 'body.1': 'x', 'header.image': 'https://x' },
    });
    expect(body).not.toHaveProperty('to');
    expect(body.template.language.code).toBe('en');
    expect(body.type).toBe('template');
    expect(body.messaging_product).toBe('whatsapp');
  });
});
