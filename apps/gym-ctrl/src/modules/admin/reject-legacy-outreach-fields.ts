import { BadRequestException } from '@nestjs/common';

export const LEGACY_OUTREACH_FIELDS = [
  'outreachTemplateName',
  'notifyTenantTemplateName',
  'outreachContactText',
  'headerImageUrl',
] as const;

export function rejectLegacyOutreachFields(body: unknown): void {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return;
  const keys = Object.keys(body as Record<string, unknown>);
  const found = LEGACY_OUTREACH_FIELDS.filter((k) => keys.includes(k));
  if (found.length > 0) {
    throw new BadRequestException(
      `Campos legado não permitidos: ${found.join(', ')}. Use outreachTemplateId, notifyTemplateId e slotBindings.`,
    );
  }
}
