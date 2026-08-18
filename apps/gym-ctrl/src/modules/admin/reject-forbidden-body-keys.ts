import { ForbiddenException } from '@nestjs/common';

export function rejectForbiddenBodyKeys(
  body: unknown,
  keys: readonly string[],
): void {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return;
  }
  const present = Object.keys(body as Record<string, unknown>);
  const found = keys.filter((key) => present.includes(key));
  if (found.length > 0) {
    throw new ForbiddenException('Acesso não permitido');
  }
}
