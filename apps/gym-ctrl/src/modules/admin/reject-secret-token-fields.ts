import { BadRequestException } from '@nestjs/common';

const FORBIDDEN_SECRET_KEYS = ['token', 'accessToken', 'whatsappToken'] as const;

/**
 * Rejeita body com tokens Meta secretos. Preferência do design/task: 400 explícito.
 */
export function rejectSecretTokenFields(body: unknown): void {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return;
  const keys = Object.keys(body as Record<string, unknown>);
  const found = FORBIDDEN_SECRET_KEYS.filter((k) => keys.includes(k));
  if (found.length > 0) {
    throw new BadRequestException(
      `Campos secretos não permitidos: ${found.join(', ')}. Use apenas tokenEnvKey.`,
    );
  }
}
