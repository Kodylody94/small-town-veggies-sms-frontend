import { describe, expect, it } from 'vitest';
import {
  api,
  buildRequestHeaders,
  CSRF_REQUEST_HEADER,
  IDEMPOTENCY_REQUEST_HEADER,
  isDemoMode,
  liveMutationsEnabled,
  MUTATION_REQUEST_HEADER,
  setCsrfToken,
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

  it('marks JSON mutations with the required preflight header', () => {
    const headers = buildRequestHeaders({ body: '{}' }, true);

    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get(MUTATION_REQUEST_HEADER)).toBe('dashboard');
  });

  it('adds session-bound CSRF and unique idempotency headers to protected mutations', () => {
    setCsrfToken('csrf-token-that-is-long-enough');
    const headers = buildRequestHeaders({}, true, {
      requiresCsrf: true,
      requiresIdempotency: true,
    });

    expect(headers.get(CSRF_REQUEST_HEADER)).toBe('csrf-token-that-is-long-enough');
    expect(headers.get(IDEMPOTENCY_REQUEST_HEADER)?.length).toBeGreaterThanOrEqual(16);
  });
});
