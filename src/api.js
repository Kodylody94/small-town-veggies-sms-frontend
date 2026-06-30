import { normalizeCollection, normalizeCustomer, normalizeOrder, normalizeProduct } from './contracts';
import { demoCustomers, demoOrders, demoProducts } from './demoData';

const apiUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const explicitDemoMode = import.meta.env.VITE_ENABLE_DEMO_DATA === 'true';
const REQUEST_TIMEOUT_MS = 15_000;

export const MUTATION_REQUEST_HEADER = 'X-Small-Town-Veggies-Request';
export const CSRF_HEADER = 'X-CSRF-Token';
export const IDEMPOTENCY_HEADER = 'Idempotency-Key';
export const isDemoMode = explicitDemoMode || !apiUrl;
export const liveMutationsEnabled =
  !isDemoMode && import.meta.env.VITE_ENABLE_LIVE_MUTATIONS === 'true';

const demoPayloads = {
  '/api/orders': demoOrders,
  '/api/customers': demoCustomers,
  '/api/products': demoProducts,
};

const demoAuthSession = {
  authenticated: true,
  administrator_id: 'demo',
  csrf_token: null,
  expires_at: null,
  demo: true,
};

let unauthorizedHandler = null;
let sessionCsrfToken = null;

function clonePayload(payload) {
  if (typeof structuredClone === 'function') return structuredClone(payload);
  return JSON.parse(JSON.stringify(payload));
}

function encodeOrderId(id) {
  const value = String(id ?? '').trim();
  if (!value) throw new Error('A valid order ID is required.');
  return encodeURIComponent(value);
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === 'function' ? handler : null;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null;
  };
}

export function setSessionSecurity(session) {
  sessionCsrfToken =
    typeof session?.csrf_token === 'string' && session.csrf_token.trim()
      ? session.csrf_token.trim()
      : null;
}

export function createIdempotencyKey() {
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function buildRequestHeaders(options = {}, isMutation = false, security = {}) {
  const headers = new Headers(options.headers ?? {});
  headers.set('Accept', 'application/json');

  if (options.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (isMutation) {
    headers.set(MUTATION_REQUEST_HEADER, 'dashboard');
    if (security.csrfToken) headers.set(CSRF_HEADER, security.csrfToken);
    if (security.idempotencyKey) headers.set(IDEMPOTENCY_HEADER, security.idempotencyKey);
  }

  return headers;
}

async function parseResponse(response) {
  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.toLowerCase().includes('json');
  let payload;

  if (isJson) {
    try {
      payload = await response.json();
    } catch (error) {
      throw new Error('The backend returned invalid JSON.', { cause: error });
    }
  } else {
    const text = await response.text();
    payload = text || null;
  }

  if (!response.ok) {
    const structuredMessage =
      payload && typeof payload === 'object'
        ? payload.message ?? payload.error
        : null;
    const plainTextMessage = contentType.startsWith('text/plain') ? payload : null;
    const message = structuredMessage ?? plainTextMessage;
    const error = new Error(
      typeof message === 'string' && message.trim()
        ? message.trim().slice(0, 300)
        : `Request failed with status ${response.status}.`,
    );
    error.status = response.status;
    if (payload && typeof payload === 'object') {
      error.code = payload.code;
      error.fieldErrors = payload.field_errors;
      error.requestId = payload.request_id;
    }
    throw error;
  }

  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data;
  }

  return payload;
}

async function networkRequest(path, options = {}, security = {}, notifyUnauthorized = true) {
  const method = (options.method ?? 'GET').toUpperCase();
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const { headers: _providedHeaders, ...fetchOptions } = options;
  const headers = buildRequestHeaders(options, security.isMutation === true, security);

  try {
    const response = await fetch(`${apiUrl}${path}`, {
      ...fetchOptions,
      method,
      headers,
      credentials: 'include',
      signal: controller.signal,
    });
    return await parseResponse(response);
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('The backend did not respond within 15 seconds.', { cause: error });
    }
    if (error?.status === 401 && notifyUnauthorized) unauthorizedHandler?.(error);
    if (error instanceof Error) throw error;
    throw new Error('An unexpected network error occurred.', { cause: error });
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

async function request(path, options = {}, isMutation = false, security = {}) {
  const method = (options.method ?? 'GET').toUpperCase();

  if (isDemoMode) {
    if (method !== 'GET') {
      throw new Error('Changes are disabled while the dashboard is in demo mode.');
    }
    return clonePayload(demoPayloads[path] ?? []);
  }

  return networkRequest(path, options, { ...security, isMutation });
}

function mutationRequest(path, options) {
  if (!liveMutationsEnabled) {
    throw new Error(
      isDemoMode
        ? 'Changes are disabled while the dashboard is in demo mode.'
        : 'Live changes are locked until VITE_ENABLE_LIVE_MUTATIONS is explicitly enabled.',
    );
  }
  if (!sessionCsrfToken) {
    throw new Error('The administrator session security token is not available. Sign in again.');
  }

  return request(path, options, true, {
    csrfToken: sessionCsrfToken,
    idempotencyKey: createIdempotencyKey(),
  });
}

export const api = {
  getSession: () =>
    isDemoMode
      ? Promise.resolve(clonePayload(demoAuthSession))
      : networkRequest('/api/auth/session', {}, {}, false),
  login: (password) =>
    isDemoMode
      ? Promise.resolve(clonePayload(demoAuthSession))
      : networkRequest(
          '/api/auth/login',
          { method: 'POST', body: JSON.stringify({ password }) },
          {},
          false,
        ),
  logout: (csrfToken) =>
    isDemoMode
      ? Promise.resolve({ authenticated: false })
      : networkRequest(
          '/api/auth/logout',
          { method: 'POST', headers: { [CSRF_HEADER]: csrfToken ?? '' } },
          {},
          false,
        ),
  getOrders: async () =>
    normalizeCollection(await request('/api/orders'), 'orders', normalizeOrder),
  confirmOrder: (id) =>
    mutationRequest(`/api/orders/${encodeOrderId(id)}/confirm`, { method: 'POST' }),
  markReady: (id) =>
    mutationRequest(`/api/orders/${encodeOrderId(id)}/ready`, { method: 'POST' }),
  markPickedUp: (id) =>
    mutationRequest(`/api/orders/${encodeOrderId(id)}/pickup`, { method: 'POST' }),
  getCustomers: async () =>
    normalizeCollection(await request('/api/customers'), 'customers', normalizeCustomer),
  getProducts: async () =>
    normalizeCollection(await request('/api/products'), 'products', normalizeProduct),
  addProduct: (product) =>
    mutationRequest('/api/products', {
      method: 'POST',
      body: JSON.stringify(product),
    }),
  createBroadcast: (message) =>
    mutationRequest('/api/broadcasts', {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
  createReminders: (orderIds) =>
    mutationRequest('/api/reminders', {
      method: 'POST',
      body: JSON.stringify({ order_ids: orderIds }),
    }),
};
