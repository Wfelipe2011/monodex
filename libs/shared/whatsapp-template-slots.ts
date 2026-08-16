export type TemplateSlotComponent = 'header' | 'body' | 'button';
export type TemplateSlotParamType = 'image' | 'text';
export type TemplateSlotFormat = 'positional' | 'named';

export type TemplateSlot = {
  key: string;
  component: TemplateSlotComponent;
  paramType: TemplateSlotParamType;
  format?: TemplateSlotFormat;
  index?: number;
  parameterName?: string;
  subType?: 'url';
};

const PLACEHOLDER_RE = /\{\{([a-zA-Z_][a-zA-Z0-9_]*|\d+)\}\}/g;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function componentType(raw: unknown): string {
  return str(raw).trim().toUpperCase();
}

function extractPlaceholders(text: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  PLACEHOLDER_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PLACEHOLDER_RE.exec(text)) !== null) {
    const token = match[1];
    if (seen.has(token)) {
      continue;
    }
    seen.add(token);
    found.push(token);
  }
  return found;
}

function namedParamsFromExample(component: Record<string, unknown>): string[] {
  const example = asRecord(component.example);
  if (!example) {
    return [];
  }
  const named = asArray(example.body_text_named_params);
  const names: string[] = [];
  for (const entry of named) {
    const rec = asRecord(entry);
    const name = str(rec?.param_name || rec?.parameter_name).trim();
    if (name && !/^\d+$/.test(name)) {
      names.push(name);
    }
  }
  return names;
}

function textSlots(
  component: TemplateSlotComponent,
  tokens: string[],
): TemplateSlot[] {
  const allNumeric = tokens.length > 0 && tokens.every((t) => /^\d+$/.test(t));
  if (allNumeric) {
    return tokens
      .map((t) => Number(t))
      .sort((a, b) => a - b)
      .map((index) => ({
        key: `${component}.${index}`,
        component,
        paramType: 'text' as const,
        format: 'positional' as const,
        index,
      }));
  }
  return tokens
    .filter((t) => !/^\d+$/.test(t))
    .map((parameterName) => ({
      key: `${component}.${parameterName}`,
      component,
      paramType: 'text' as const,
      format: 'named' as const,
      parameterName,
    }));
}

function parseHeader(component: Record<string, unknown>): TemplateSlot[] {
  const format = str(component.format).toUpperCase();
  if (format === 'IMAGE' || format === 'VIDEO' || format === 'DOCUMENT') {
    if (format === 'IMAGE') {
      return [
        {
          key: 'header.image',
          component: 'header',
          paramType: 'image',
        },
      ];
    }
    return [];
  }
  const tokens = extractPlaceholders(str(component.text));
  return textSlots('header', tokens);
}

function parseBody(component: Record<string, unknown>): TemplateSlot[] {
  const fromText = extractPlaceholders(str(component.text));
  const fromExample = namedParamsFromExample(component);
  const tokens = fromText.length > 0 ? fromText : fromExample;
  return textSlots('body', tokens);
}

function parseButtons(component: Record<string, unknown>): TemplateSlot[] {
  const buttons = asArray(component.buttons);
  const slots: TemplateSlot[] = [];
  buttons.forEach((button, index) => {
    const rec = asRecord(button);
    if (!rec) {
      return;
    }
    const type = str(rec.type || rec.sub_type).toUpperCase();
    if (type !== 'URL') {
      return;
    }
    const url = str(rec.url);
    if (!extractPlaceholders(url).length && !url.includes('{{')) {
      return;
    }
    slots.push({
      key: `button.${index}.url`,
      component: 'button',
      paramType: 'text',
      index,
      subType: 'url',
    });
  });
  return slots;
}

export function parseTemplateSlots(components: unknown): TemplateSlot[] {
  const list = asArray(components);
  const slots: TemplateSlot[] = [];
  for (const item of list) {
    const rec = asRecord(item);
    if (!rec) {
      continue;
    }
    const type = componentType(rec.type);
    if (type === 'HEADER') {
      slots.push(...parseHeader(rec));
      continue;
    }
    if (type === 'BODY') {
      slots.push(...parseBody(rec));
      continue;
    }
    if (type === 'BUTTONS' || type === 'BUTTON') {
      slots.push(...parseButtons(rec));
    }
  }
  return slots;
}
