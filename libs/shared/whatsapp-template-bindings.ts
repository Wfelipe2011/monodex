export const BINDING_TYPES = [
  'literal',
  'header_image',
  'lead.name',
  'lead.phone',
  'lead.city',
  'lead.category',
  'lead.rating',
  'tenant.phone',
  'now.date',
  'now.datetime',
] as const;

export type BindingType = (typeof BINDING_TYPES)[number];

export type SlotBinding = {
  type: BindingType | string;
  value?: string | null;
};

export type BindingLeadContext = {
  name?: string | null;
  phone?: string | null;
  cityName?: string | null;
  category?: string | null;
  rating?: number | null;
};

export type BindingResolveContext = {
  lead?: BindingLeadContext | null;
  tenant?: { phone?: string | null } | null;
  now?: Date;
};

const EMPTY = '—';
const TZ = 'America/Sao_Paulo';

const BINDING_TYPE_SET = new Set<string>(BINDING_TYPES);

function trimValue(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function emptyToDash(value: string | null | undefined): string {
  const t = trimValue(value);
  return t ? t : EMPTY;
}

export function normalizeBrazilPhoneDigits(raw: string | null | undefined): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (!digits) {
    return EMPTY;
  }
  return digits.startsWith('55') ? digits : `55${digits}`;
}

function part(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): string {
  return parts.find((p) => p.type === type)?.value ?? '';
}

function formatNow(now: Date, withTime: boolean): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime
      ? { hour: '2-digit' as const, minute: '2-digit' as const, hour12: false }
      : {}),
  }).formatToParts(now);
  const date = `${part(parts, 'day')}/${part(parts, 'month')}/${part(parts, 'year')}`;
  if (!withTime) {
    return date;
  }
  return `${date} ${part(parts, 'hour')}:${part(parts, 'minute')}`;
}

function formatRating(rating: number | null | undefined): string {
  if (rating === null || rating === undefined || Number.isNaN(Number(rating))) {
    return EMPTY;
  }
  return Number(rating).toLocaleString('pt-BR');
}

export function resolveBindingValue(
  binding: SlotBinding,
  ctx: BindingResolveContext = {},
): string {
  const type = binding?.type;
  if (!type || !BINDING_TYPE_SET.has(type)) {
    throw new Error(`Unknown binding type: ${String(type)}`);
  }
  const now = ctx.now ?? new Date();
  const lead = ctx.lead ?? {};

  switch (type as BindingType) {
    case 'literal':
    case 'header_image':
      return trimValue(binding.value);
    case 'lead.name':
      return emptyToDash(lead.name);
    case 'lead.phone':
      return normalizeBrazilPhoneDigits(lead.phone);
    case 'lead.city':
      return emptyToDash(lead.cityName);
    case 'lead.category':
      return emptyToDash(lead.category);
    case 'lead.rating':
      return formatRating(lead.rating);
    case 'tenant.phone':
      return normalizeBrazilPhoneDigits(ctx.tenant?.phone);
    case 'now.date':
      return formatNow(now, false);
    case 'now.datetime':
      return formatNow(now, true);
    default:
      throw new Error(`Unknown binding type: ${String(type)}`);
  }
}
