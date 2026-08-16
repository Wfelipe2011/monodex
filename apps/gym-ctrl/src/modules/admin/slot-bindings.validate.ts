import { BadRequestException } from '@nestjs/common';
import { BINDING_TYPES } from '@core/shared/whatsapp-template-bindings';

const BINDING_TYPE_SET = new Set<string>(BINDING_TYPES);

export type SlotBindingInput = { type: string; value?: string };
export type SlotBindingsInput = {
  outreach: Record<string, SlotBindingInput>;
  notify: Record<string, SlotBindingInput>;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function assertBinding(
  role: 'outreach' | 'notify',
  key: string,
  raw: unknown,
): SlotBindingInput {
  if (!isPlainObject(raw) || typeof raw.type !== 'string') {
    throw new BadRequestException(
      `slotBindings.${role}.${key} deve ser um objeto { type, value? }`,
    );
  }
  const type = raw.type.trim();
  if (!BINDING_TYPE_SET.has(type)) {
    throw new BadRequestException(
      `slotBindings.${role}.${key}: type inválido "${type}"`,
    );
  }

  const valueRaw = raw.value;
  const value =
    valueRaw === undefined || valueRaw === null ? undefined : String(valueRaw);

  if (type === 'literal' || type === 'header_image') {
    const trimmed = (value ?? '').trim();
    if (!trimmed) {
      throw new BadRequestException(
        `slotBindings.${role}.${key}: type ${type} exige value não vazio`,
      );
    }
    if (type === 'header_image' && !isHttpsUrl(trimmed)) {
      throw new BadRequestException(
        `slotBindings.${role}.${key}: header_image exige URL https`,
      );
    }
    if (type === 'literal') {
      if (/[\n\r\t]/.test(trimmed)) {
        throw new BadRequestException(
          `slotBindings.${role}.${key}: literal não pode conter newline/tab`,
        );
      }
      if (key.startsWith('body.') && trimmed.length > 80) {
        throw new BadRequestException(
          `slotBindings.${role}.${key}: literal de body no máximo 80 caracteres`,
        );
      }
    }
    return { type, value: trimmed };
  }

  return { type };
}

export function assertSlotBindingsValid(raw: unknown): SlotBindingsInput {
  if (!isPlainObject(raw)) {
    throw new BadRequestException('slotBindings deve ser um objeto');
  }
  if (!isPlainObject(raw.outreach) || !isPlainObject(raw.notify)) {
    throw new BadRequestException(
      'slotBindings deve conter objetos outreach e notify',
    );
  }

  const outreach: Record<string, SlotBindingInput> = {};
  for (const [key, binding] of Object.entries(raw.outreach)) {
    outreach[key] = assertBinding('outreach', key, binding);
  }
  const notify: Record<string, SlotBindingInput> = {};
  for (const [key, binding] of Object.entries(raw.notify)) {
    notify[key] = assertBinding('notify', key, binding);
  }
  return { outreach, notify };
}

export function persistedSlotKeys(slots: unknown): string[] {
  if (!Array.isArray(slots)) return [];
  const keys: string[] = [];
  for (const entry of slots) {
    if (isPlainObject(entry) && typeof entry.key === 'string' && entry.key) {
      keys.push(entry.key);
    }
  }
  return keys;
}
