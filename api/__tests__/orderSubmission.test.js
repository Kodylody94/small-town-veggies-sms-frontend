import { describe, expect, it } from 'vitest';
import { createBackendHandler } from '../_lib/router.js';
import {
  MemoryAuditStore,
  MemoryIdempotencyStore,
  MemoryRateLimiter,
} from '../_lib/stores.js';

const NOW = Date.UTC(2026, 5, 30, 12, 0, 0);
const ORIGIN = 'https://dashboard.example.com';

function makeRequest(body, headers = {}) {
  return {
    method: 'POST',
    query: { path: 'order-submissions' },
    headers: {
      origin: ORIGIN,
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/json',
      'x-small-town-veggies-request': 'order-form',
      'idempotency-key': 'sandbox-order-request-0001',
      ...headers,
    },
    body,
    url: '/api/router?path=order-submissions',
  };
}

function makeResponse() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
    end(body) {
      this.body = body;
    },
  };
}

function makeDependencies() {
  const orderGateway = {
    submissions: [],
    async submit(order) {
      this.submissions.push(structuredClone(order));
      return {
        id: `sandbox-order-${this.submissions.length}`,
        status: order.order_status,
        customer_name: order.customer_name,
        total: order.total,
        pickup_date: order.pickup_date,
        pickup_location: order.pickup_location,
        submitted_at: new Date(NOW).toISOString(),
      };
    },
  };

  return {
    config: {
      production: true,
      appOrigin: ORIGIN,
      sessionSecret: 'session-secret-that-is-at-least-thirty-two-characters',
      adminPasswordHash: 'unused',
      sessionTtlSeconds: 3600,
      allowSameSiteRequests: false,
      runtimeMode: 'test',
    },
    publicRateLimiter: new MemoryRateLimiter({ limit: 20, now: () => NOW }),
    publicIdempotencyStore: new MemoryIdempotencyStore(),
    orderGateway,
    auditStore: new MemoryAuditStore(),
    now: () => NOW,
  };
}

const validBody = {
  customer_name: 'Kody Loper',
  phone: '(601) 555-0147',
  bucket_price: 30,
  quantity: 2,
  pickup_date: '2026-07-03',
  notes: 'Text before pickup.',
};

async function dispatch(handler, body, headers) {
  const response = makeResponse();
  await handler(makeRequest(body, headers), response);
  return response;
}

describe('public sandbox order submission', () => {
  it('normalizes, forwards, and audits an allowlisted order payload', async () => {
    const dependencies = makeDependencies();
    const handler = createBackendHandler(dependencies);
    const response = await dispatch(handler, validBody);

    expect(response.statusCode).toBe(202);
    expect(response.payload.data).toMatchObject({
      id: 'sandbox-order-1',
      status: 'received',
      total: 60,
      pickup_location: 'Small Town Veggies Ovett',
    });
    expect(dependencies.orderGateway.submissions[0]).toMatchObject({
      customer_name: 'Kody Loper',
      phone: '+16015550147',
      total: 60,
      payment_status: 'unpaid',
      order_status: 'received',
    });
    expect(dependencies.auditStore.entries).toContainEqual(
      expect.objectContaining({ operation: 'order.submit', outcome: 'success' }),
    );
    expect(JSON.stringify(response.payload)).not.toContain('tm_test_');
  });

  it('does not forward the same idempotency key twice', async () => {
    const dependencies = makeDependencies();
    const handler = createBackendHandler(dependencies);
    const first = await dispatch(handler, validBody);
    const replay = await dispatch(handler, validBody);

    expect(replay.payload.data.id).toBe(first.payload.data.id);
    expect(dependencies.orderGateway.submissions).toHaveLength(1);
  });

  it('rejects the dashboard marker and invalid order fields', async () => {
    const handler = createBackendHandler(makeDependencies());
    const wrongMarker = await dispatch(handler, validBody, {
      'x-small-town-veggies-request': 'dashboard',
    });
    const invalid = await dispatch(handler, {
      ...validBody,
      phone: '123',
      bucket_price: 20,
      quantity: 0,
    }, {
      'idempotency-key': 'sandbox-order-request-0002',
    });

    expect(wrongMarker.statusCode).toBe(403);
    expect(wrongMarker.payload.code).toBe('MUTATION_MARKER_REQUIRED');
    expect(invalid.statusCode).toBe(422);
    expect(invalid.payload.field_errors).toMatchObject({
      phone: expect.any(String),
      bucket_price: expect.any(String),
      quantity: expect.any(String),
    });
  });
});
