import { BadRequestException } from '@nestjs/common';
import { ListCampaignButtonAction } from '@prisma/client';
import { BINDING_TYPES } from '@core/shared/whatsapp-template-bindings';

const BINDING_TYPE_SET = new Set<string>(BINDING_TYPES);
const BUTTON_ACTION_SET = new Set<string>(
  Object.values(ListCampaignButtonAction),
);

export type SlotBindingInput = { type: string; value?: string };
export type SendSlotBindingsInput = {
  send: Record<string, SlotBindingInput>;
};
export type NotifySlotBindingsInput = {
  notify: Record<string, SlotBindingInput>;
};
export type ButtonActionInput = {
  buttonIndex: number;
  label: string;
  action: ListCampaignButtonAction;
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
  role: 'send' | 'notify',
  key: string,
  raw: unknown,
  rootField: 'slotBindings' | 'notifySlotBindings',
): SlotBindingInput {
  if (!isPlainObject(raw) || typeof raw.type !== 'string') {
    throw new BadRequestException(
      `${rootField}.${role}.${key} deve ser um objeto { type, value? }`,
    );
  }
  const type = raw.type.trim();
  if (!BINDING_TYPE_SET.has(type)) {
    throw new BadRequestException(
      `${rootField}.${role}.${key}: type inválido "${type}"`,
    );
  }

  const valueRaw = raw.value;
  const value =
    valueRaw === undefined || valueRaw === null ? undefined : String(valueRaw);

  if (type === 'literal' || type === 'header_image') {
    const trimmed = (value ?? '').trim();
    if (!trimmed) {
      throw new BadRequestException(
        `${rootField}.${role}.${key}: type ${type} exige value não vazio`,
      );
    }
    if (type === 'header_image' && !isHttpsUrl(trimmed)) {
      throw new BadRequestException(
        `${rootField}.${role}.${key}: header_image exige URL https`,
      );
    }
    if (type === 'literal') {
      if (/[\n\r\t]/.test(trimmed)) {
        throw new BadRequestException(
          `${rootField}.${role}.${key}: literal não pode conter newline/tab`,
        );
      }
      if (key.startsWith('body.') && trimmed.length > 80) {
        throw new BadRequestException(
          `${rootField}.${role}.${key}: literal de body no máximo 80 caracteres`,
        );
      }
    }
    return { type, value: trimmed };
  }

  return { type };
}

export function assertSendSlotBindingsValid(raw: unknown): SendSlotBindingsInput {
  if (!isPlainObject(raw)) {
    throw new BadRequestException('slotBindings deve ser um objeto');
  }
  if (!isPlainObject(raw.send)) {
    throw new BadRequestException('slotBindings deve conter objeto send');
  }

  const send: Record<string, SlotBindingInput> = {};
  for (const [key, binding] of Object.entries(raw.send)) {
    send[key] = assertBinding('send', key, binding, 'slotBindings');
  }
  return { send };
}

export function assertNotifySlotBindingsValid(
  raw: unknown,
): NotifySlotBindingsInput {
  if (!isPlainObject(raw)) {
    throw new BadRequestException('notifySlotBindings deve ser um objeto');
  }
  if (!isPlainObject(raw.notify)) {
    throw new BadRequestException('notifySlotBindings deve conter objeto notify');
  }

  const notify: Record<string, SlotBindingInput> = {};
  for (const [key, binding] of Object.entries(raw.notify)) {
    notify[key] = assertBinding('notify', key, binding, 'notifySlotBindings');
  }
  return { notify };
}

export function assertButtonActionsValid(raw: unknown): ButtonActionInput[] {
  if (!Array.isArray(raw)) {
    throw new BadRequestException('buttonActions deve ser um array');
  }

  return raw.map((item, index) => {
    if (!isPlainObject(item)) {
      throw new BadRequestException(
        `buttonActions[${index}] deve ser um objeto`,
      );
    }
    if (
      typeof item.buttonIndex !== 'number' ||
      !Number.isInteger(item.buttonIndex) ||
      item.buttonIndex < 0
    ) {
      throw new BadRequestException(
        `buttonActions[${index}].buttonIndex deve ser inteiro ≥ 0`,
      );
    }
    const label = typeof item.label === 'string' ? item.label.trim() : '';
    if (!label) {
      throw new BadRequestException(
        `buttonActions[${index}].label é obrigatório`,
      );
    }
    const actionRaw =
      typeof item.action === 'string' ? item.action.trim().toUpperCase() : '';
    if (!BUTTON_ACTION_SET.has(actionRaw)) {
      throw new BadRequestException(
        `buttonActions[${index}].action inválida "${String(item.action)}"`,
      );
    }
    return {
      buttonIndex: item.buttonIndex,
      label,
      action: actionRaw as ListCampaignButtonAction,
    };
  });
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

export function hasNotifyButtonAction(
  buttonActions: ButtonActionInput[],
): boolean {
  return buttonActions.some((entry) => entry.action === 'NOTIFY');
}
