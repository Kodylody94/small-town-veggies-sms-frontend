import { normalizeCollection, normalizeCustomer, normalizeOrder, normalizeProduct } from './contracts';
import { demoCustomers, demoOrders, demoProducts } from './demoData';

const apiUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const explicitDemoMode = import.meta.env.VITE_ENABLE_DEMO_DATA === 'true';
const REQUEST_TIMEOUT_MS = 15_000;

export const MUTATION_REQUEST_HEADER = 'X-Small-Town-Veggies-Request';
export const isDemoMode = explicitDemoMode || !apiUrl;
export const liveMutationsEnabled =
  !isDemoMode && import.meta.env.VITE_ENABLE_LIVE_MUTATIONS === 'true';

const demoPayloads = {
  '/api/orders': demoOrders,
  '/api/customers': demoCustomers,
  '/api/products': demoProducts,
};

function clonePayload(payload) {
  if (typeof structuredClone === 'function') return structuredClone(payload);
  return JSON.parse(JSON.stringify(payload));
}

function encodeOrderId(id) {
  const value = String(id ?? '').trim();
  if (!value) throw new Error('A valid order ID is required.');
  return encodeURIComponent(value);
}

export function buildRequestHeaders(options = {}, isMutation = false) {
  const headers = new Headers(options.headers ?? {});
  headers.set('Accept', 'application/json');

  if (options.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (isMutation) {
    // This non-secret custom header forces a browser CORS preflight. The backend must
    // require it together with exact-origin CORS and Origin/Fetch-Metadata checks.
    headers.set(MUTATION_REQUEST_HEADER, 'dashboard');
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

    throw new Error(
      typeof message === 'string' && message.trim()
        ? message.trim().slice(0, 300)
        : `Request failed with status ${response.status}.`,
    );
  }

  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data;
  }

  return payload;
}

async function request(path, options = {}, isMutation = false) {
  const method = (options.method ?? 'GET').toUpperCase();

  if (isDemoMode) {
    if (method !== 'GET') {
      throw new Error('Changes are disabled while the dashboard is in demo mode.');
    }
    return clonePayload(demoPayloads[path] ?? []);
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const { headers: _providedHeaders, ...fetchOptions } = options;
  const headers = buildRequestHeaders(options, isMutation);

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
    if (error instanceof Error) throw error;
    throw new Error('An unexpected network error occurred.', { cause: error });
  } finally {
    window.clearTimeout(timeoutId);
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
  return request(path, options, true);
}

export const api = {
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
