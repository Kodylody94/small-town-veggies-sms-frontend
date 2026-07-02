import { describe, expect, it } from 'vitest';
import { addDaysToDateOnly, parseDateOnly, pickupDateRange } from '../dateOnly';

describe('America/Chicago date-only helpers', () => {
  it('uses the Central Time calendar day around the UTC boundary', () => {
    expect(pickupDateRange(Date.parse('2026-07-03T04:30:00.000Z'))).toEqual({
      minimum: '2026-07-02',
      maximum: '2026-08-31',
    });
    expect(pickupDateRange(Date.parse('2026-07-03T05:30:00.000Z'))).toEqual({
      minimum: '2026-07-03',
      maximum: '2026-09-01',
    });
  });

  it('validates real calendar dates and handles year rollover', () => {
    expect(parseDateOnly('2026-02-29')).toBeNull();
    expect(parseDateOnly('2028-02-29')?.value).toBe('2028-02-29');
    expect(addDaysToDateOnly('2026-12-31', 1)).toBe('2027-01-01');
  });
});
