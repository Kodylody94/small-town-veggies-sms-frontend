import { describe, expect, it, vi } from 'vitest';
import {
  createThreeMinOrderGateway,
  ThreeMinOrderGateway,
} from '../_lib/threeMinOrderGateway.js';

const API_URL = 'https://api.3minapi.com/api/v1/data/sandbox_endpoint_123';
const API_KEY = 'tm_test_example_create_only_key';
const NOW = Date.UTC(2026, 6, 2, 18, 0, 0);
const order = {
  customer_name: 'Sandbox Customer',
  phone: '+16015550147',
  items: [{ name: 'Fresh Vegetable Bucket', quantity: 1, unit_price: 30 }],
  total: 30,
  pickup_date: '2026-07-03',
  pickup_location: 'Small Town Veggies Ovett',
  payment_status: 'unpaid',
  order_status: 'received',
  notes: 'Sandbox only',
  created_at: '2026-07-02T18:00:00.000Z',
};

function providerResponse(status, payload, options = {}) {
  const contentType = options.contentType ?? 'application/json; charset=utf-8';
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get(name) {
        return name.toLowerCase() === 'content-type' ? contentType : null;
      },
    },
    async json() {
      if (options.invalidJson) throw new SyntaxError('invalid json');
      return payload;
    },
  };
}

function gateway(overrides = {}) {
  return new ThreeMinOrderGateway({
    enabled: true,
    environment: 'sandbox',
    apiUrl: API_URL,
    apiKey: API_KEY,
    fetchImpl: vi.fn(async () => providerResponse(202, { id: 'record-123' })),
    now: () => NOW,
    ...overrides,
  });
}

async function captureError(promise) {
  try {
    await promise;
    throw new Error('Expected promise to reject');
  } catch (error) {
    return error;
  }
}

describe('ThreeMinOrderGateway', () => {
  it('fails closed when public submissions are disabled', async () => {
    const error = await captureError(gateway({ enabled: false }).submit(order));
    expect(error).toMatchObject({ status: 503, code: 'ORDER_SUBMISSIONS_DISABLED' });
  });

  it('rejects any non-sandbox environment', async () => {
    const error = await captureError(gateway({ environment: 'production' }).submit(order));
    expect(error).toMatchObject({ status: 503, code: 'ORDER_PROVIDER_NOT_CONFIGURED', expose: false });
  });

  it('rejects a missing fetch implementation', async () => {
    const error = await captureError(gateway({ fetchImpl: null }).submit(order));
    expect(error).toMatchObject({ status: 503, code: 'ORDER_PROVIDER_UNAVAILABLE', expose: false });
  });

  it('rejects a missing endpoint URL', async () => {
    const error = await captureError(gateway({ apiUrl: '' }).submit(order));
    expect(error).toMatchObject({ status: 503, code: 'ORDER_PROVIDER_NOT_CONFIGURED', expose: false });
  });

  it.each([
    'not-a-url',
    'http://api.3minapi.com/api/v1/data/test',
    'https://example.com/api/v1/data/test',
    'https://api.3minapi.com:8443/api/v1/data/test',
    'https://user:pass@api.3minapi.com/api/v1/data/test',
    'https://api.3minapi.com/api/v1/data/test?key=value',
    'https://api.3minapi.com/api/v1/data/test#fragment',
    'https://api.3minapi.com/api/v1/other/test',
    'https://api.3minapi.com/api/v1/data/',
  ])('rejects an unapproved endpoint URL: %s', async (apiUrl) => {
    const error = await captureError(gateway({ apiUrl }).submit(order));
    expect(error).toMatchObject({ status: 503, code: 'ORDER_PROVIDER_NOT_CONFIGURED', expose: false });
  });

  it('rejects a missing sandbox credential', async () => {
    const error = await captureError(gateway({ apiKey: '' }).submit(order));
    expect(error).toMatchObject({ status: 503, code: 'ORDER_PROVIDER_NOT_CONFIGURED', expose: false });
  });

  it.each(['tm_live_not_allowed', 'plain-text-key', 'test_tm_test_wrong_prefix'])('rejects an invalid sandbox credential: %s', async (apiKey) => {
    const error = await captureError(gateway({ apiKey }).submit(order));
    expect(error).toMatchObject({ status: 503, code: 'ORDER_PROVIDER_NOT_CONFIGURED', expose: false });
    expect(error.message).not.toContain(apiKey);
  });

  it('accepts only the documented asynchronous 202 response and forwards the exact payload', async () => {
    const fetchImpl = vi.fn(async () => providerResponse(202, { id: 'record-202' }));
    const result = await gateway({ fetchImpl }).submit(order);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe(API_URL);
    expect(options).toMatchObject({
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    expect(JSON.parse(options.body)).toEqual(order);
    expect(result).toEqual({
      id: 'record-202',
      status: 'received',
      customer_name: 'Sandbox Customer',
      total: 30,
      pickup_date: '2026-07-03',
      pickup_location: 'Small Town Veggies Ovett',
      submitted_at: '2026-07-02T18:00:00.000Z',
    });
  });

  it('accepts a record ID nested under data', async () => {
    const result = await gateway({
      fetchImpl: vi.fn(async () => providerResponse(202, { data: { id: 'nested-record' } })),
    }).submit(order);
    expect(result.id).toBe('nested-record');
  });

  it.each([200, 201, 204, 400, 401, 403, 429, 500])('rejects provider status %s', async (status) => {
    const error = await captureError(gateway({
      fetchImpl: vi.fn(async () => providerResponse(status, { id: 'unexpected' })),
    }).submit(order));
    expect(error).toMatchObject({ status: 502, code: 'ORDER_PROVIDER_REJECTED', expose: false });
  });

  it('rejects a non-JSON success response', async () => {
    const error = await captureError(gateway({
      fetchImpl: vi.fn(async () => providerResponse(202, null, { contentType: 'text/plain' })),
    }).submit(order));
    expect(error).toMatchObject({ status: 502, code: 'ORDER_PROVIDER_INVALID_RESPONSE', expose: false });
  });

  it('rejects malformed JSON from the provider', async () => {
    const error = await captureError(gateway({
      fetchImpl: vi.fn(async () => providerResponse(202, null, { invalidJson: true })),
    }).submit(order));
    expect(error).toMatchObject({ status: 502, code: 'ORDER_PROVIDER_INVALID_RESPONSE', expose: false });
  });

  it.each([null, {}, { id: '' }, { data: {} }])('rejects a success response without a record ID', async (payload) => {
    const error = await captureError(gateway({
      fetchImpl: vi.fn(async () => providerResponse(202, payload)),
    }).submit(order));
    expect(error).toMatchObject({ status: 502, code: 'ORDER_PROVIDER_INVALID_RESPONSE', expose: false });
  });

  it('normalizes network failures without exposing provider details', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error(`network failed with ${API_KEY}`);
    });
    const error = await captureError(gateway({ fetchImpl }).submit(order));

    expect(error).toMatchObject({ status: 503, code: 'ORDER_PROVIDER_UNAVAILABLE', expose: false });
    expect(error.message).not.toContain(API_KEY);
  });

  it('aborts requests that exceed the configured timeout', async () => {
    const fetchImpl = vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      }, { once: true });
    }));
    const error = await captureError(gateway({ fetchImpl, timeoutMs: 5 }).submit(order));

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(error).toMatchObject({ status: 503, code: 'ORDER_PROVIDER_UNAVAILABLE', expose: false });
  });

  it('does not expose credentials or provider payloads in normalized failures', async () => {
    const providerSecret = 'provider-secret-detail';
    const error = await captureError(gateway({
      fetchImpl: vi.fn(async () => providerResponse(500, {
        error: providerSecret,
        authorization: API_KEY,
      })),
    }).submit(order));
    const publicShape = JSON.stringify({
      status: error.status,
      code: error.code,
      message: error.message,
      fieldErrors: error.fieldErrors,
    });

    expect(publicShape).not.toContain(API_KEY);
    expect(publicShape).not.toContain(providerSecret);
  });

  it('maps server environment variables without changing their values', () => {
    const instance = createThreeMinOrderGateway({
      ENABLE_PUBLIC_ORDER_SUBMISSIONS: 'true',
      THREE_MIN_API_ENVIRONMENT: 'sandbox',
      THREE_MIN_API_URL: API_URL,
      THREE_MIN_API_SANDBOX_KEY: API_KEY,
    }, { fetchImpl: vi.fn(), now: () => NOW });

    expect(instance).toMatchObject({
      enabled: true,
      environment: 'sandbox',
      apiUrl: API_URL,
      apiKey: API_KEY,
    });
  });
});
