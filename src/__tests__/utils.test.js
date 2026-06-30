import { describe, expect, it } from 'vitest';
import {
  filterOrders,
  formatDate,
  formatMoney,
  formatStatus,
  recentOrders,
  summarizeOrders,
} from '../utils';

const orders = [
  { id: 1, status: 'pending' },
  { id: 3, status: 'ready' },
  { id: 2, status: 'confirmed' },
  { id: 4, status: 'pending' },
];

describe('dashboard utilities', () => {
  it('summarizes order statuses in one safe result', () => {
    expect(summarizeOrders(orders)).toEqual({ total: 4, pending: 2, confirmed: 1, ready: 1 });
    expect(summarizeOrders(null)).toEqual({ total: 0, pending: 0, confirmed: 0, ready: 0 });
  });

  it('filters orders without mutating the source array', () => {
    expect(filterOrders(orders, 'pending')).toHaveLength(2);
    expect(filterOrders(orders, 'all')).toBe(orders);
    expect(filterOrders(undefined, 'all')).toEqual([]);
  });

  it('sorts recent orders without mutating the source array', () => {
    expect(recentOrders(orders, 2).map((order) => order.id)).toEqual([4, 3]);
    expect(orders.map((order) => order.id)).toEqual([1, 3, 2, 4]);
  });

  it('formats valid display values', () => {
    expect(formatStatus('picked_up')).toBe('Picked Up');
    expect(formatMoney(30)).toBe('$30.00');
    expect(formatDate('2026-06-18')).toBe('Jun 18, 2026');
  });

  it('uses safe placeholders for malformed display values', () => {
    expect(formatStatus(null)).toBe('Unknown');
    expect(formatMoney('not-a-price')).toBe('—');
    expect(formatDate('2026-02-31')).toBe('—');
  });
});
