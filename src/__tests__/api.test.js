import { describe, expect, it } from 'vitest';
import { api, isDemoMode, liveMutationsEnabled } from '../api';

describe('API safety defaults', () => {
  it('returns defensive copies of demo data', async () => {
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
});
