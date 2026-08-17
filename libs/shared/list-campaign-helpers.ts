export type QuickReplyButton = {
  index: number;
  label: string;
};

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

/** Digits-only phone with `55` prefix for list unique constraint and Graph `to`. */
export function normalizeListPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) {
    return '';
  }
  return digits.startsWith('55') ? digits : `55${digits}`;
}

/** Lowercase accent-folded key for category suggestions/dedup — not for stored display value. */
export function normalizeCategoryKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Extract QUICK_REPLY button labels from Meta template `components` JSON. */
export function extractQuickReplyButtons(components: unknown): QuickReplyButton[] {
  const result: QuickReplyButton[] = [];
  for (const item of asArray(components)) {
    const component = asRecord(item);
    if (!component) {
      continue;
    }
    const type = componentType(component.type);
    if (type !== 'BUTTONS' && type !== 'BUTTON') {
      continue;
    }
    asArray(component.buttons).forEach((button, index) => {
      const rec = asRecord(button);
      if (!rec) {
        return;
      }
      const buttonType = componentType(rec.type || rec.sub_type);
      if (buttonType !== 'QUICK_REPLY') {
        return;
      }
      const label = str(rec.text).trim();
      if (!label) {
        return;
      }
      result.push({ index, label });
    });
  }
  return result;
}

/** schedule JSON: weekday → UTC hours, e.g. { "2": [18], "4": [13, 18] } */
export function isWithinSchedule(
  schedule: unknown,
  day: number,
  hour: number,
): boolean {
  if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) {
    return false;
  }
  const map = schedule as Record<string, unknown>;
  const hours = map[String(day)];
  return Array.isArray(hours) && hours.includes(hour);
}
