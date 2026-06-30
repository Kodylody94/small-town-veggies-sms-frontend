import { describe, expect, it } from 'vitest';
import {
  normalizeCollection,
  normalizeCustomer,
  normalizeOrder,
  normalizeProduct,
} from '../contracts';

describe('API record contracts', () => {
  it('accepts only literal true as customer consent', () => {
    expect(normalizeCustomer({ id: 1, opted_in: true }).consent_state).toBe('opted_in');
    expect(normalizeCustomer({ id: 2, opted_in: false }).consent_state).toBe('opted_out');

    const ambiguous = normalizeCustomer({ id: 3, opted_in: 'false' });
    expect(ambiguous.opted_in).toBe(false);
    expect(ambiguous.consent_state).toBe('unknown');
  });

  it('accepts only literal true as product availability', () => {
    expect(normalizeProduct({ id: 1, active: true }).availability_state).toBe('available');
    expect(normalizeProduct({ id: 2, active: false }).availability_state).toBe('unavailable');

    const ambiguous = normalizeProduct({ id: 3, active: 'true' });
    expect(ambiguous.active).toBe(false);
    expect(ambiguous.availability_state).toBe('unknown');
  });

  it('normalizes unsupported order statuses to unknown', () => {
    expect(normalizeOrder({ id: 1, status: 'pending' }).status).toBe('pending');
    expect(normalizeOrder({ id: 2, status: 'cancelled' }).status).toBe('unknown');
  });

  it('rejects malformed collections and records', () => {
    expect(() => normalizeCollection({}, 'customers', normalizeCustomer)).toThrow(/invalid customers response/i);
    expect(() => normalizeCollection([null], 'customers', normalizeCustomer)).toThrow(/invalid customer record/i);
    expect(() => normalizeCollection([{ name: 'Missing ID' }], 'customers', normalizeCustomer)).toThrow(/valid ID/i);
  });
});
