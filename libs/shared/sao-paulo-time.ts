/**
 * America/Sao_Paulo is UTC−3 year-round (DST abolished).
 * Documented fixed offset — same approach as `saoPauloDayRange` in ops.service.
 */
export const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';
export const SAO_PAULO_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Naive local datetime only — timezone is always America/Sao_Paulo (implicit). */
const LOCAL_HOUR_RE =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/;

/**
 * Parse a wall-clock date+hour in São Paulo into the UTC instant of that hour start.
 * Rejects non-zero minutes/seconds (hour granularity only).
 */
export function parseSaoPauloHourToUtc(scheduledFor: string): Date {
  const trimmed = scheduledFor.trim();
  const m = LOCAL_HOUR_RE.exec(trimmed);
  if (!m) {
    throw new Error(
      'scheduledFor inválido; use YYYY-MM-DDTHH:00:00 (hora em America/Sao_Paulo)',
    );
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6] ?? '0');
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23
  ) {
    throw new Error('scheduledFor com data/hora inválida');
  }
  if (minute !== 0 || second !== 0) {
    throw new Error(
      'scheduledFor deve ser no início da hora (minuto e segundo = 0)',
    );
  }
  // Wall time SP → UTC: add +3h to the wall components interpreted as UTC.
  return new Date(
    Date.UTC(year, month - 1, day, hour, 0, 0, 0) + SAO_PAULO_OFFSET_MS,
  );
}

/** UTC instant of the start of the current hour in America/Sao_Paulo. */
export function startOfCurrentSaoPauloHour(now: Date = new Date()): Date {
  const spWall = new Date(now.getTime() - SAO_PAULO_OFFSET_MS);
  return new Date(
    Date.UTC(
      spWall.getUTCFullYear(),
      spWall.getUTCMonth(),
      spWall.getUTCDate(),
      spWall.getUTCHours(),
      0,
      0,
      0,
    ) + SAO_PAULO_OFFSET_MS,
  );
}

/** True when `scheduledFor` is strictly before the current SP hour. */
export function isSaoPauloHourInPast(
  scheduledForUtc: Date,
  now: Date = new Date(),
): boolean {
  return scheduledForUtc.getTime() < startOfCurrentSaoPauloHour(now).getTime();
}
