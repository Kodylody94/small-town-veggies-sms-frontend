import { normalizeCollection, normalizeCustomer, normalizeOrder, normalizeProduct } from './contracts';
import { demoCustomers, demoOrders, demoProducts } from './demoData';

const configuredApiUrl = (import.meta.env.VITE_API_URL ?? '').trim();
const apiUrl = configuredApiUrl === 'same-origin' ? '' : configuredApiUrl.replace(/\/$/, '');
const explicitDemoMode = import.meta.env.VITE_ENABLE_DEMO_DATA === 'true';
const REQUEST_TIMEOUT_MS = 15_000;

export const MUTATION_REQUEST_HEADER = 'X-Small-Town-Veggies-Request';
export const CSRF_REQUEST_HEADER = 'X-CSRF-Token';
export const IDEMPOTENCY_REQUEST_HEADER = 'Idempotency-Key';
export const DASHBOARD_REQUEST_MARKER = 'dashboard';
export const ORDER_FORM_REQUEST_MARKER = 'order-form';
export const isDemoMode = explicitDemoMode || !configuredApiUrl;
export const liveMutationsEnabled =
  !isDemoMode && import.meta.env.VITE_ENABLE_LIVE_MUTATIONS === 'true';

let csrfToken = null;

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

function clonePayload(payload) {
  if (typeof structuredClone === 'function') return structuredClone(payload);
  return JSON.parse(JSON.stringify(payload));
}

function encodeOrderId(id) {
  const value = String(id ?? '').trim();
  if (!value) throw new Error('A valid order ID is required.');
  return encodeURIComponent(value);
}

export function createIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(24);
    globalThis.crypto.getRandomValues(bytes);
    return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  throw new Error('Secure idempotency key generation is unavailable in this browser.');
}

export function setCsrfToken(value) {
  csrfToken = typeof value === 'string' && value.length >= 20 ? value : null;
}

export function clearCsrfToken() {
  csrfToken = null;
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === 'function' ? handler : null;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null;
  };
}

export function setSessionSecurity(session) {
  setCsrfToken(session?.csrf_token);
}

export function buildRequestHeaders(options = {}, isMutation = false, policy = {}) {
  const headers = new Headers(options.headers ?? {});
  headers.set('Accept', 'application/json');

  if ((options.body != null || isMutation) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (isMutation) {
    headers.set(MUTATION_REQUEST_HEADER, policy.requestMarker ?? DASHBOARD_REQUEST_MARKER);

    if (policy.requiresCsrf) {
      if (!csrfToken) {
        throw new Error('A valid administrator session is required before making changes.');
      }
      headers.set(CSRF_REQUEST_HEADER, csrfToken);
    }

    if (policy.requiresIdempotency && !headers.has(IDEMPOTENCY_REQUEST_HEADER)) {
      headers.set(IDEMPOTENCY_REQUEST_HEADER, createIdempotencyKey());
    }
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

async function request(path, options = {}, policy = {}) {
  const method = (options.method ?? 'GET').toUpperCase();
  const isMutation = policy.mutation === true;

  if (isDemoMode && !policy.allowInDemoMode) {
    if (method !== 'GET') {
      throw new Error('Changes are disabled while the dashboard is in demo mode.');
    }
    return clonePayload(demoPayloads[path] ?? []);
  }

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const { headers: _providedHeaders, ...fetchOptions } = options;
  const headers = buildRequestHeaders(options, isMutation, policy);

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
    if (error?.status === 401 && policy.notifyUnauthorized !== false) unauthorizedHandler?.(error);
    if (error instanceof Error) throw error;
    throw new Error('An unexpected network error occurred.', { cause: error });
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

function mutationRequest(path, options) {
  if (!liveMutationsEnabled) {
    throw new Error(
      isDemoMode
        ? 'Changes are disabled while the dashboard is in demo mode.'
        : 'Live changes are locked until VITE_ENABLE_LIVE_MUTATIONS is explicitly enabled.',
    );
  }
  return request(path, options, {
    mutation: true,
    requiresCsrf: true,
    requiresIdempotency: true,
  });
}

function orderSubmissionRequest(order) {
  return request(
    '/api/order-submissions',
    {
      method: 'POST',
      body: JSON.stringify(order),
    },
    {
      mutation: true,
      requiresIdempotency: true,
      requestMarker: ORDER_FORM_REQUEST_MARKER,
      allowInDemoMode: true,
      notifyUnauthorized: false,
    },
  );
}

export const api = {
  login: async (password) => {
    if (isDemoMode) return clonePayload(demoAuthSession);
    const session = await request(
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify({ password }) },
      { mutation: true, notifyUnauthorized: false },
    );
    setCsrfToken(session?.csrf_token);
    return session;
  },
  getSession: async () => {
    if (isDemoMode) return clonePayload(demoAuthSession);
    const session = await request('/api/auth/session', {}, { notifyUnauthorized: false });
    setCsrfToken(session?.csrf_token);
    return session;
  },
  logout: async (sessionCsrfToken) => {
    if (isDemoMode) return { authenticated: false };
    if (sessionCsrfToken) setCsrfToken(sessionCsrfToken);
    const result = await request(
      '/api/auth/logout',
      { method: 'POST' },
      { mutation: true, requiresCsrf: true, notifyUnauthorized: false },
    );
    clearCsrfToken();
    return result;
  },
  submitOrder: orderSubmissionRequest,
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
