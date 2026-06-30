import { describe, expect, it } from 'vitest';
import { createBackendHandler } from '../_lib/router.js';
import { createPasswordHash } from '../_lib/password.js';
import {
  MemoryAuditStore,
  MemoryIdempotencyStore,
  MemoryRateLimiter,
  MemoryRepository,
  MemorySessionStore,
} from '../_lib/stores.js';

const NOW = Date.UTC(2026, 5, 30, 12, 0, 0);
const ORIGIN = 'https://dashboard.example.com';
const PASSWORD_HASH = createPasswordHash('correct horse battery staple');

function makeConfig() {
  return {
    production: true,
    appOrigin: ORIGIN,
    sessionSecret: 'session-secret-that-is-at-least-thirty-two-characters',
    adminPasswordHash: PASSWORD_HASH,
    sessionTtlSeconds: 3600,
    allowSameSiteRequests: false,
    runtimeMode: 'test',
  };
}

function makeDependencies(overrides = {}) {
  return {
    config: makeConfig(),
    repository: new MemoryRepository({
      orders: [
        { id: 1, customer_name: 'Kody', status: 'pending', total: 25 },
        { id: 2, customer_name: 'Jamie', status: 'confirmed', total: 30 },
      ],
      customers: [{ id: 1, name: 'Kody', opted_in: true }],
      products: [{ id: 1, name: 'Tomatoes', price: 25, unit: 'bucket', active: true }],
    }),
    sessionStore: new MemorySessionStore({ now: () => NOW }),
    rateLimiter: new MemoryRateLimiter({ limit: 20, now: () => NOW }),
    idempotencyStore: new MemoryIdempotencyStore(),
    auditStore: new MemoryAuditStore(),
    now: () => NOW,
    ...overrides,
  };
}

function makeRequest(path, options = {}) {
  return {
    method: options.method || 'GET',
    query: { path: path.replace(/^\//, '') },
    headers: Object.fromEntries(
      Object.entries(options.headers || {}).map(([key, value]) => [key.toLowerCase(), value]),
    ),
    body: options.body,
    url: `/api/router?path=${encodeURIComponent(path.replace(/^\//, ''))}`,
  };
}

function makeResponse() {
  return {
    statusCode: 200,
    headers: {},
    payload: undefined,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(statusCode) {
      this.statusCode = statusCode;
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

async function dispatch(handler, path, options) {
  const response = makeResponse();
  await handler(makeRequest(path, options), response);
  return response;
}

async function login(handler) {
  const response = await dispatch(handler, '/auth/login', {
    method: 'POST',
    headers: {
      origin: ORIGIN,
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/json',
      'x-small-town-veggies-request': 'dashboard',
    },
    body: { password: 'correct horse battery staple' },
  });

  return {
    response,
    cookie: response.headers['Set-Cookie'].split(';')[0],
    csrf: response.payload.data.csrf_token,
  };
}

function protectedHeaders(session, extra = {}) {
  return {
    origin: ORIGIN,
    cookie: session.cookie,
    'sec-fetch-site': 'same-origin',
    'content-type': 'application/json',
    'x-small-town-veggies-request': 'dashboard',
    'x-csrf-token': session.csrf,
    ...extra,
  };
}

describe('protected backend router', () => {
  it('keeps health available while reporting missing runtime configuration', async () => {
    const handler = createBackendHandler({
      ...makeDependencies(),
      config: undefined,
      getConfig: () => {
        throw new Error('missing');
      },
    });

    const response = await dispatch(handler, '/health');
    expect(response.statusCode).toBe(200);
    expect(response.payload.data).toMatchObject({
      status: 'ok',
      configured: false,
      database: 'not_connected',
      session_store: 'not_connected',
      live_mutations: false,
      messaging: 'disabled',
    });
  });

  it('rejects login from a non-allowlisted origin', async () => {
    const handler = createBackendHandler(makeDependencies());
    const response = await dispatch(handler, '/auth/login', {
      method: 'POST',
      headers: {
        origin: 'https://evil.example.com',
        'content-type': 'application/json',
        'x-small-town-veggies-request': 'dashboard',
      },
      body: { password: 'correct horse battery staple' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.payload.code).toBe('ORIGIN_NOT_ALLOWED');
  });

  it('creates a secure signed session and exposes only the CSRF token', async () => {
    const handler = createBackendHandler(makeDependencies());
    const session = await login(handler);

    expect(session.response.statusCode).toBe(200);
    expect(session.response.headers['Set-Cookie']).toContain('HttpOnly');
    expect(session.response.headers['Set-Cookie']).toContain('Secure');
    expect(session.response.headers['Set-Cookie']).toContain('SameSite=Strict');
    expect(session.response.headers['Set-Cookie']).toContain('Max-Age=3600');
    expect(session.csrf.length).toBeGreaterThan(20);
    expect(session.response.payload.data).not.toHaveProperty('session_token');
  });

  it('requires a valid administrator session for protected reads', async () => {
    const handler = createBackendHandler(makeDependencies());
    const response = await dispatch(handler, '/orders', {
      headers: { origin: ORIGIN },
    });

    expect(response.statusCode).toBe(401);
    expect(response.payload.code).toBe('INVALID_SESSION');
  });

  it('revokes the server-side session during logout', async () => {
    const handler = createBackendHandler(makeDependencies());
    const session = await login(handler);
    const logoutResponse = await dispatch(handler, '/auth/logout', {
      method: 'POST',
      headers: protectedHeaders(session),
      body: {},
    });
    const replayResponse = await dispatch(handler, '/orders', {
      headers: { origin: ORIGIN, cookie: session.cookie },
    });

    expect(logoutResponse.statusCode).toBe(200);
    expect(logoutResponse.headers['Set-Cookie']).toContain('Max-Age=0');
    expect(replayResponse.statusCode).toBe(401);
    expect(replayResponse.payload.code).toBe('SESSION_REVOKED');
  });

  it('returns contract envelopes for authenticated collections', async () => {
    const handler = createBackendHandler(makeDependencies());
    const session = await login(handler);
    const response = await dispatch(handler, '/orders', {
      headers: { origin: ORIGIN, cookie: session.cookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.payload.meta).toEqual({ next_cursor: null, count: 2 });
    expect(response.payload.data[0]).toMatchObject({ id: 1, status: 'pending' });
  });

  it('rejects protected mutations without the session-bound CSRF token', async () => {
    const handler = createBackendHandler(makeDependencies());
    const session = await login(handler);
    const response = await dispatch(handler, '/orders/1/confirm', {
      method: 'POST',
      headers: {
        ...protectedHeaders(session, { 'idempotency-key': 'confirm-order-0001' }),
        'x-csrf-token': 'wrong-token',
      },
      body: {},
    });

    expect(response.statusCode).toBe(403);
    expect(response.payload.code).toBe('CSRF_TOKEN_INVALID');
  });

  it('performs allowed order transitions idempotently and audits them', async () => {
    const dependencies = makeDependencies();
    const handler = createBackendHandler(dependencies);
    const session = await login(handler);
    const options = {
      method: 'POST',
      headers: protectedHeaders(session, { 'idempotency-key': 'confirm-order-0001' }),
      body: {},
    };

    const first = await dispatch(handler, '/orders/1/confirm', options);
    const replay = await dispatch(handler, '/orders/1/confirm', options);

    expect(first.statusCode).toBe(200);
    expect(first.payload.data.status).toBe('confirmed');
    expect(replay.statusCode).toBe(200);
    expect(replay.payload.data.status).toBe('confirmed');
    expect(dependencies.auditStore.entries.some((entry) => entry.operation === 'order.confirm')).toBe(true);
  });

  it('rejects invalid order transitions without changing the record', async () => {
    const dependencies = makeDependencies();
    const handler = createBackendHandler(dependencies);
    const session = await login(handler);
    const response = await dispatch(handler, '/orders/1/ready', {
      method: 'POST',
      headers: protectedHeaders(session, { 'idempotency-key': 'ready-order-000001' }),
      body: {},
    });

    expect(response.statusCode).toBe(409);
    expect(response.payload.code).toBe('INVALID_ORDER_TRANSITION');
    expect((await dependencies.repository.listOrders())[0].status).toBe('pending');
  });

  it('returns field errors for invalid product creation', async () => {
    const handler = createBackendHandler(makeDependencies());
    const session = await login(handler);
    const response = await dispatch(handler, '/products', {
      method: 'POST',
      headers: protectedHeaders(session, { 'idempotency-key': 'create-product-001' }),
      body: { name: '', unit: '', price: -1 },
    });

    expect(response.statusCode).toBe(422);
    expect(response.payload.code).toBe('VALIDATION_FAILED');
    expect(response.payload.field_errors).toMatchObject({
      name: expect.any(String),
      unit: expect.any(String),
      price: expect.any(String),
    });
  });

  it('keeps customer messaging disabled after authentication and CSRF checks', async () => {
    const handler = createBackendHandler(makeDependencies());
    const session = await login(handler);
    const response = await dispatch(handler, '/broadcasts', {
      method: 'POST',
      headers: protectedHeaders(session, { 'idempotency-key': 'broadcast-disabled-01' }),
      body: { message: 'Test' },
    });

    expect(response.statusCode).toBe(503);
    expect(response.payload.code).toBe('MESSAGING_DISABLED');
  });

  it('answers exact-origin preflight requests with a narrow allowlist', async () => {
    const handler = createBackendHandler(makeDependencies());
    const response = await dispatch(handler, '/orders/1/confirm', {
      method: 'OPTIONS',
      headers: { origin: ORIGIN },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers['Access-Control-Allow-Origin']).toBe(ORIGIN);
    expect(response.headers['Access-Control-Allow-Credentials']).toBe('true');
    expect(response.headers['Access-Control-Allow-Headers']).not.toContain('*');
  });
});
