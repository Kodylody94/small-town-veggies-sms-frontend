import { describe, expect, it } from 'vitest';
import { filterOrders, formatMoney, formatStatus, summarizeOrders } from '../utils';

const orders = [
  { id: 1, status: 'pending' },
  { id: 2, status: 'confirmed' },
  { id: 3, status: 'ready' },
  { id: 4, status: 'pending' },
];

describe('dashboard utilities', () => {
  it('summarizes order statuses', () => {
    expect(summarizeOrders(orders)).toEqual({ total: 4, pending: 2, confirmed: 1, ready: 1 });
  });

  it('filters orders without mutating the source array', () => {
    expect(filterOrders(orders, 'pending')).toHaveLength(2);
    expect(filterOrders(orders, 'all')).toBe(orders);
  });

  it('formats display values', () => {
    expect(formatStatus('picked_up')).toBe('Picked Up');
    expect(formatMoney(30)).toBe('$30.00');
  });
});
