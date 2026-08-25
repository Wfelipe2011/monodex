import {
  parseTemplateSlots,
  TemplateSlot,
} from './whatsapp-template-slots';

/** Row mínima do catálogo para montar o DTO de preview client-side. */
export type TemplatePreviewRow = {
  id: number;
  metaId: string | null;
  name: string;
  language: string;
  status: string;
  category: string | null;
  parameterFormat: string | null;
  slots: unknown;
  components: unknown;
  lastSyncedAt: Date | string;
};

export type TemplatePreviewDto = {
  id: number;
  metaId: string | null;
  name: string;
  language: string;
  status: string;
  category: string | null;
  parameterFormat: string | null;
  slots: TemplateSlot[];
  components: unknown;
  lastSyncedAt: Date | string;
};

/**
 * Reusa slots persistidos quando não vazios; senão deriva de `components`
 * (mesma lógica de asSlots nos services).
 */
export function resolveTemplateSlots(
  slotsJson: unknown,
  components: unknown,
): TemplateSlot[] {
  if (Array.isArray(slotsJson) && slotsJson.length > 0) {
    return slotsJson as TemplateSlot[];
  }
  return parseTemplateSlots(components);
}

/**
 * Mapper puro row → DTO de preview. Não interpola placeholders;
 * `components` é o JSON Meta persistido (sem strip).
 */
export function toTemplatePreviewDto(
  row: TemplatePreviewRow,
): TemplatePreviewDto {
  return {
    id: row.id,
    metaId: row.metaId,
    name: row.name,
    language: row.language,
    status: row.status,
    category: row.category,
    parameterFormat: row.parameterFormat,
    slots: resolveTemplateSlots(row.slots, row.components),
    components: row.components,
    lastSyncedAt: row.lastSyncedAt,
  };
}
