import { TemplateSlot } from './whatsapp-template-slots';

export type GraphTemplateParameter = Record<string, unknown>;
export type GraphTemplateComponent = Record<string, unknown>;

function sortBodySlots(slots: TemplateSlot[]): TemplateSlot[] {
  const positional = slots
    .filter((s) => s.format === 'positional')
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const named = slots.filter((s) => s.format !== 'positional');
  return [...positional, ...named];
}

function bodyParameter(slot: TemplateSlot, text: string): GraphTemplateParameter {
  if (slot.format === 'named' && slot.parameterName) {
    return {
      type: 'text',
      parameter_name: slot.parameterName,
      text,
    };
  }
  return {
    type: 'text',
    text,
  };
}

export function buildTemplateComponents(
  slots: TemplateSlot[],
  values: Record<string, string>,
): GraphTemplateComponent[] {
  const components: GraphTemplateComponent[] = [];

  const headerImage = slots.find((s) => s.key === 'header.image');
  if (headerImage && values[headerImage.key] != null && values[headerImage.key] !== '') {
    components.push({
      type: 'header',
      parameters: [
        {
          type: 'image',
          image: { link: values[headerImage.key] },
        },
      ],
    });
  }

  const headerText = slots.filter(
    (s) => s.component === 'header' && s.paramType === 'text' && values[s.key] != null,
  );
  if (headerText.length > 0) {
    components.push({
      type: 'header',
      parameters: sortBodySlots(headerText).map((slot) =>
        bodyParameter(slot, values[slot.key]),
      ),
    });
  }

  const bodySlots = slots.filter(
    (s) => s.component === 'body' && values[s.key] != null,
  );
  if (bodySlots.length > 0) {
    components.push({
      type: 'body',
      parameters: sortBodySlots(bodySlots).map((slot) =>
        bodyParameter(slot, values[slot.key]),
      ),
    });
  }

  const buttonSlots = slots
    .filter((s) => s.component === 'button' && values[s.key] != null)
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  for (const slot of buttonSlots) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: String(slot.index ?? 0),
      parameters: [
        {
          type: 'text',
          text: values[slot.key],
        },
      ],
    });
  }

  return components;
}

export function buildTemplateSendBody(args: {
  name: string;
  language: string;
  slots: TemplateSlot[];
  values: Record<string, string>;
}): {
  messaging_product: 'whatsapp';
  type: 'template';
  template: {
    name: string;
    language: { code: string };
    components: GraphTemplateComponent[];
  };
} {
  return {
    messaging_product: 'whatsapp',
    type: 'template',
    template: {
      name: args.name,
      language: { code: args.language },
      components: buildTemplateComponents(args.slots, args.values),
    },
  };
}
