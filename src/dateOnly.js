export const BUSINESS_TIME_ZONE = 'America/Chicago';
const DAY_MS = 24 * 60 * 60 * 1000;

function datePartsInTimeZone(now, timeZone = BUSINESS_TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date(now))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function parseDateOnly(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { value: normalized, timestamp };
}

export function addDaysToDateOnly(value, days) {
  const parsed = parseDateOnly(value);
  if (!parsed || !Number.isInteger(days)) return null;
  return new Date(parsed.timestamp + days * DAY_MS).toISOString().slice(0, 10);
}

export function pickupDateRange(now = Date.now()) {
  const minimum = datePartsInTimeZone(now);
  return {
    minimum,
    maximum: addDaysToDateOnly(minimum, 60),
  };
}
