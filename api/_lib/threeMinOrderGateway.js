import { ApiError } from './errors.js';

const DEFAULT_TIMEOUT_MS = 10_000;
const THREE_MIN_HOSTNAME = 'api.3minapi.com';
const THREE_MIN_DATA_PATH = /^\/api\/v1\/data\/[A-Za-z0-9_-]+$/;

function requireServerSetting(name, value) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    throw new ApiError(503, 'ORDER_PROVIDER_NOT_CONFIGURED', `${name} is not configured.`, {
      expose: false,
    });
  }
  return normalized;
}

function requireEndpointUrl(value) {
  const normalized = requireServerSetting('THREE_MIN_API_URL', value).replace(/\/$/, '');
  let url;
  try {
    url = new URL(normalized);
  } catch (error) {
    throw new ApiError(503, 'ORDER_PROVIDER_NOT_CONFIGURED', 'The order provider URL is invalid.', {
      cause: error,
      expose: false,
    });
  }

  if (
    url.protocol !== 'https:' ||
    url.hostname !== THREE_MIN_HOSTNAME ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !THREE_MIN_DATA_PATH.test(url.pathname)
  ) {
    throw new ApiError(503, 'ORDER_PROVIDER_NOT_CONFIGURED', 'The order provider URL is invalid.', {
      expose: false,
    });
  }

  return url.toString().replace(/\/$/, '');
}

async function parseProviderResponse(response) {
  const contentType = response.headers?.get?.('content-type') ?? '';
  if (!contentType.toLowerCase().includes('json')) return null;

  try {
    return await response.json();
  } catch {
    return null;
  }
}

export class ThreeMinOrderGateway {
  constructor({
    enabled = false,
    environment = 'sandbox',
    apiUrl,
    apiKey,
    fetchImpl = globalThis.fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    now = () => Date.now(),
  } = {}) {
    this.enabled = enabled;
    this.environment = environment;
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.now = now;
  }

  async submit(order) {
    if (!this.enabled) {
      throw new ApiError(503, 'ORDER_SUBMISSIONS_DISABLED', 'Online order requests are not enabled yet.');
    }
    if (this.environment !== 'sandbox') {
      throw new ApiError(503, 'ORDER_PROVIDER_NOT_CONFIGURED', 'Only the approved sandbox order provider is enabled.', {
        expose: false,
      });
    }
    if (typeof this.fetchImpl !== 'function') {
      throw new ApiError(503, 'ORDER_PROVIDER_UNAVAILABLE', 'The order provider is unavailable.', {
        expose: false,
      });
    }

    const apiUrl = requireEndpointUrl(this.apiUrl);
    const apiKey = requireServerSetting('THREE_MIN_API_SANDBOX_KEY', this.apiKey);
    if (!apiKey.startsWith('tm_test_')) {
      throw new ApiError(503, 'ORDER_PROVIDER_NOT_CONFIGURED', 'The sandbox order credential is invalid.', {
        expose: false,
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    let response;

    try {
      response = await this.fetchImpl(apiUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(order),
        signal: controller.signal,
      });
    } catch (error) {
      throw new ApiError(503, 'ORDER_PROVIDER_UNAVAILABLE', 'The order provider could not be reached.', {
        cause: error,
        expose: false,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const payload = await parseProviderResponse(response);
    if (!response.ok || response.status !== 202) {
      throw new ApiError(502, 'ORDER_PROVIDER_REJECTED', 'The order provider did not accept the request.', {
        expose: false,
      });
    }

    const id = String(payload?.id ?? payload?.data?.id ?? '').trim();
    if (!id) {
      throw new ApiError(502, 'ORDER_PROVIDER_INVALID_RESPONSE', 'The order provider returned an invalid response.', {
        expose: false,
      });
    }

    return {
      id,
      status: order.order_status,
      customer_name: order.customer_name,
      total: order.total,
      pickup_date: order.pickup_date,
      pickup_location: order.pickup_location,
      submitted_at: new Date(this.now()).toISOString(),
    };
  }
}

export function createThreeMinOrderGateway(env = process.env, options = {}) {
  return new ThreeMinOrderGateway({
    enabled: env.ENABLE_PUBLIC_ORDER_SUBMISSIONS === 'true',
    environment: env.THREE_MIN_API_ENVIRONMENT || 'sandbox',
    apiUrl: env.THREE_MIN_API_URL,
    apiKey: env.THREE_MIN_API_SANDBOX_KEY,
    ...options,
  });
}
