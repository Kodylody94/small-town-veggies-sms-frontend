import { describe, expect, it } from 'vitest';
import { validateProductForm } from '../validation';

describe('product validation', () => {
  it('normalizes valid product values', () => {
    const result = validateProductForm({
      name: '  Purple Hull Peas ',
      price: '25.50',
      unit: ' bucket ',
    });

    expect(result.isValid).toBe(true);
    expect(result.value).toEqual({ name: 'Purple Hull Peas', price: 25.5, unit: 'bucket' });
  });

  it('rejects empty, negative, and excessive values', () => {
    expect(validateProductForm({ name: ' ', price: '-1', unit: '' })).toMatchObject({
      isValid: false,
      errors: {
        name: expect.any(String),
        price: expect.any(String),
        unit: expect.any(String),
      },
    });

    expect(validateProductForm({ name: 'Tomatoes', price: '10001', unit: 'box' }).isValid).toBe(false);
  });
});
