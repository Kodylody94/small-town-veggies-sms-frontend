import { describe, expect, it } from 'vitest';
import {
  buildRequestHeaders,
  CSRF_REQUEST_HEADER,
  IDEMPOTENCY_REQUEST_HEADER,
  MUTATION_REQUEST_HEADER,
  ORDER_FORM_REQUEST_MARKER,
} from '../api';

describe('order submission request headers', () => {
  it('uses the public order marker and an idempotency key without a CSRF token', () => {
    const headers = buildRequestHeaders({ body: '{}' }, true, {
      requestMarker: ORDER_FORM_REQUEST_MARKER,
      requiresIdempotency: true,
    });

    expect(headers.get(MUTATION_REQUEST_HEADER)).toBe(ORDER_FORM_REQUEST_MARKER);
    expect(headers.get(IDEMPOTENCY_REQUEST_HEADER)?.length).toBeGreaterThanOrEqual(16);
    expect(headers.has(CSRF_REQUEST_HEADER)).toBe(false);
  });
});
