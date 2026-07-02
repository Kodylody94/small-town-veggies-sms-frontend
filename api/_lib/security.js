import { timingSafeEqual } from 'node:crypto';
import { ApiError } from './errors.js';
import { getHeader, setHeader } from './http.js';

export const MUTATION_MARKER_HEADER = 'X-Small-Town-Veggies-Request';
export const CSRF_HEADER = 'X-CSRF-Token';
export const DASHBOARD_REQUEST_MARKER = 'dashboard';
export const ORDER_FORM_REQUEST_MARKER = 'order-form';

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left ?? ''));
  const rightBuffer = Buffer.from(String(right ?? ''));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function applyCors(request, response, config) {
  const origin = getHeader(request, 'origin');
  if (origin && origin === config.appOrigin) {
    setHeader(response, 'Access-Control-Allow-Origin', config.appOrigin);
    setHeader(response, 'Access-Control-Allow-Credentials', 'true');
    setHeader(response, 'Vary', 'Origin');
  }
}

export function handlePreflight(request, response, config) {
  const origin = getHeader(request, 'origin');
  if (origin !== config.appOrigin) {
    throw new ApiError(403, 'ORIGIN_NOT_ALLOWED', 'The request origin is not allowed.');
  }

  applyCors(request, response, config);
  setHeader(response, 'Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  setHeader(
    response,
    'Access-Control-Allow-Headers',
    `Content-Type, ${MUTATION_MARKER_HEADER}, ${CSRF_HEADER}, Idempotency-Key`,
  );
  setHeader(response, 'Access-Control-Max-Age', '600');
  response.statusCode = 204;
  if (typeof response.end === 'function') response.end();
  return response;
}

export function requireAllowedOrigin(request, config) {
  if (getHeader(request, 'origin') !== config.appOrigin) {
    throw new ApiError(403, 'ORIGIN_NOT_ALLOWED', 'The request origin is not allowed.');
  }
}

function requireJsonMutation(request, config, marker) {
  requireAllowedOrigin(request, config);

  const fetchSite = getHeader(request, 'sec-fetch-site');
  const allowedFetchSites = config.allowSameSiteRequests
    ? new Set(['same-origin', 'same-site'])
    : new Set(['same-origin']);
  if (fetchSite && !allowedFetchSites.has(fetchSite)) {
    throw new ApiError(403, 'FETCH_SITE_NOT_ALLOWED', 'The request site context is not allowed.');
  }

  if (getHeader(request, MUTATION_MARKER_HEADER) !== marker) {
    throw new ApiError(403, 'MUTATION_MARKER_REQUIRED', 'The protected mutation marker is missing.');
  }

  const contentType = getHeader(request, 'content-type').toLowerCase();
  if (!contentType.startsWith('application/json')) {
    throw new ApiError(415, 'JSON_REQUIRED', 'Protected mutations require application/json.');
  }
}

export function requireMutationSecurity(request, config, options = {}) {
  requireJsonMutation(request, config, DASHBOARD_REQUEST_MARKER);

  if (options.csrfToken && !safeEqual(getHeader(request, CSRF_HEADER), options.csrfToken)) {
    throw new ApiError(403, 'CSRF_TOKEN_INVALID', 'The CSRF token is invalid or missing.');
  }
}

export function requireOrderSubmissionSecurity(request, config) {
  requireJsonMutation(request, config, ORDER_FORM_REQUEST_MARKER);
}
