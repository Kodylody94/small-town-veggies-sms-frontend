import { describe, expect, it } from 'vitest';
import {
  api,
  buildRequestHeaders,
  createIdempotencyKey,
  CSRF_HEADER,
  IDEMPOTENCY_HEADER,
  isDemoMode,
  liveMutationsEnabled,
  MUTATION_REQUEST_HEADER,
} from '../api';

describe('API safety defaults', () => {
  it('returns defensive copies of normalized demo data', async () => {
    expect(isDemoMode).toBe(true);
    const first = await api.getOrders();
    const originalLength = first.length;
    first.pop();

    expect(await api.getOrders()).toHaveLength(originalLength);
  });

  it('blocks mutations unless the explicit live mutation gate is enabled', () => {
    expect(liveMutationsEnabled).toBe(false);
    expect(() => api.confirmOrder(1042)).toThrow(/disabled|locked/i);
  });

  it('marks protected mutations with preflight, CSRF, and idempotency headers', () => {
    const headers = buildRequestHeaders(
      { body: '{}' },
      true,
      { csrfToken: 'csrf-token', idempotencyKey: '1234567890abcdef' },
    );

    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get(MUTATION_REQUEST_HEADER)).toBe('dashboard');
    expect(headers.get(CSRF_HEADER)).toBe('csrf-token');
    expect(headers.get(IDEMPOTENCY_HEADER)).toBe('1234567890abcdef');
  });

  it('creates unique idempotency keys long enough for the backend contract', () => {
    const first = createIdempotencyKey();
    const second = createIdempotencyKey();

    expect(first.length).toBeGreaterThanOrEqual(16);
    expect(second.length).toBeGreaterThanOrEqual(16);
    expect(first).not.toBe(second);
  });
});
