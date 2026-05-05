const DEFAULT_ACTIVE_DUTY_MAX_HOURS = 12;

function parsePositiveHours(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export const ACTIVE_DUTY_MAX_HOURS =
  parsePositiveHours(process.env.ACTIVE_DUTY_MAX_HOURS) ?? DEFAULT_ACTIVE_DUTY_MAX_HOURS;

export const ACTIVE_DUTY_MAX_AGE_MS = ACTIVE_DUTY_MAX_HOURS * 60 * 60 * 1000;

export function isActiveDutySessionFresh(
  startTime: Date | string | null | undefined,
  now = Date.now(),
): boolean {
  if (!startTime) return false;
  const startedAt = startTime instanceof Date ? startTime.getTime() : new Date(startTime).getTime();
  if (!Number.isFinite(startedAt)) return false;
  return startedAt <= now && now - startedAt <= ACTIVE_DUTY_MAX_AGE_MS;
}

export function splitActiveDutySessionsByFreshness<T extends { startTime: Date | string | null | undefined }>(
  sessions: T[],
  now = Date.now(),
) {
  const fresh: T[] = [];
  const stale: T[] = [];

  for (const session of sessions) {
    if (isActiveDutySessionFresh(session.startTime, now)) fresh.push(session);
    else stale.push(session);
  }

  return { fresh, stale };
}
