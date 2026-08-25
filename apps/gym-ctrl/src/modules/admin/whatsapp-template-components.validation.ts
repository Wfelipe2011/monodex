import { BadRequestException } from '@nestjs/common';

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

function hasPlaceholders(text: string): boolean {
  PLACEHOLDER_RE.lastIndex = 0;
  return PLACEHOLDER_RE.test(text);
}

function hasNonEmptyStringInNestedArrays(value: unknown): boolean {
  if (typeof value === 'string' && value.trim() !== '') {
    return true;
  }
  if (!Array.isArray(value)) {
    return false;
  }
  return value.some((item) => hasNonEmptyStringInNestedArrays(item));
}

function hasBodyExample(example: Record<string, unknown> | null): boolean {
  if (!example) {
    return false;
  }
  if (hasNonEmptyStringInNestedArrays(example.body_text)) {
    return true;
  }
  const named = asArray(example.body_text_named_params);
  return named.some((entry) => {
    const rec = asRecord(entry);
    const exampleValue = str(rec?.example).trim();
    return exampleValue !== '';
  });
}

function hasHeaderTextExample(example: Record<string, unknown> | null): boolean {
  if (!example) {
    return false;
  }
  return hasNonEmptyStringInNestedArrays(example.header_text);
}

function hasHeaderImageHandle(example: Record<string, unknown> | null): boolean {
  if (!example) {
    return false;
  }
  const handles = asArray(example.header_handle);
  return handles.some((h) => typeof h === 'string' && h.trim() !== '');
}

/**
 * Valida components MARKETING mínimos antes do Graph:
 * BODY obrigatório; placeholders exigem example; HEADER IMAGE exige header_handle.
 */
export function assertValidMarketingTemplateComponents(
  components: unknown,
): asserts components is Record<string, unknown>[] {
  if (!Array.isArray(components) || components.length === 0) {
    throw new BadRequestException(
      'components deve ser um array não vazio',
    );
  }

  const records = components.map((item, index) => {
    const rec = asRecord(item);
    if (!rec) {
      throw new BadRequestException(
        `components[${index}] deve ser um objeto`,
      );
    }
    return rec;
  });

  const body = records.find((c) => componentType(c.type) === 'BODY');
  if (!body) {
    throw new BadRequestException('components deve incluir um BODY');
  }

  const bodyText = str(body.text);
  if (!bodyText.trim()) {
    throw new BadRequestException('BODY.text é obrigatório');
  }
  if (hasPlaceholders(bodyText) && !hasBodyExample(asRecord(body.example))) {
    throw new BadRequestException(
      'BODY com variáveis exige example (body_text ou body_text_named_params)',
    );
  }

  for (const component of records) {
    const type = componentType(component.type);
    if (type === 'HEADER') {
      const format = str(component.format).toUpperCase();
      if (format === 'IMAGE') {
        if (!hasHeaderImageHandle(asRecord(component.example))) {
          throw new BadRequestException(
            'HEADER IMAGE exige example.header_handle com handle válido',
          );
        }
      } else if (format === 'TEXT' || format === '') {
        const headerText = str(component.text);
        if (
          hasPlaceholders(headerText) &&
          !hasHeaderTextExample(asRecord(component.example))
        ) {
          throw new BadRequestException(
            'HEADER TEXT com variáveis exige example.header_text',
          );
        }
      }
    }

    if (type === 'BUTTONS') {
      const buttons = asArray(component.buttons);
      for (const [i, button] of buttons.entries()) {
        const btn = asRecord(button);
        if (!btn) {
          continue;
        }
        const btnType = str(btn.type).toUpperCase();
        if (btnType === 'URL' && hasPlaceholders(str(btn.url))) {
          const example = btn.example;
          const ok =
            (typeof example === 'string' && example.trim() !== '') ||
            (Array.isArray(example) &&
              example.some((e) => typeof e === 'string' && e.trim() !== ''));
          if (!ok) {
            throw new BadRequestException(
              `BUTTONS[${i}] URL com variável exige example`,
            );
          }
        }
      }
    }
  }
}
