import { randomUUID } from 'node:crypto';
import { ApiError, normalizeError } from './errors.js';

export function getHeader(request, name) {
  const headers = request?.headers;
  if (!headers) return '';
  if (typeof headers.get === 'function') return headers.get(name) ?? '';

  const value = headers[name.toLowerCase()] ?? headers[name] ?? '';
  return Array.isArray(value) ? value.join(', ') : String(value);
}

export function requestPath(request) {
  const queryPath = request?.query?.path;
  if (Array.isArray(queryPath)) return `/${queryPath.join('/')}`;
  if (queryPath) return `/${String(queryPath).replace(/^\/+/, '')}`;

  try {
    return new URL(request.url, 'http://localhost').pathname.replace(/^\/api(?:\/router)?/, '') || '/';
  } catch {
    return '/';
  }
}

export async function readJson(request, maximumBytes = 16_384) {
  const contentLength = Number(getHeader(request, 'content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new ApiError(413, 'REQUEST_TOO_LARGE', 'The request body is too large.');
  }

  if (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) {
    return request.body;
  }

  if (typeof request.body === 'string' || Buffer.isBuffer(request.body)) {
    const text = Buffer.from(request.body).toString('utf8');
    if (Buffer.byteLength(text) > maximumBytes) {
      throw new ApiError(413, 'REQUEST_TOO_LARGE', 'The request body is too large.');
    }
    try {
      return text ? JSON.parse(text) : {};
    } catch (error) {
      throw new ApiError(400, 'INVALID_JSON', 'The request body contains invalid JSON.', { cause: error });
    }
  }

  if (!request || typeof request[Symbol.asyncIterator] !== 'function') return {};

  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    total += buffer.length;
    if (total > maximumBytes) {
      throw new ApiError(413, 'REQUEST_TOO_LARGE', 'The request body is too large.');
    }
    chunks.push(buffer);
  }

  const text = Buffer.concat(chunks).toString('utf8');
  try {
    return text ? JSON.parse(text) : {};
  } catch (error) {
    throw new ApiError(400, 'INVALID_JSON', 'The request body contains invalid JSON.', { cause: error });
  }
}

export function setHeader(response, name, value) {
  if (typeof response.setHeader === 'function') response.setHeader(name, value);
  else {
    response.headers ??= {};
    response.headers[name] = value;
  }
}

export function sendJson(response, status, payload) {
  if (typeof response.status === 'function' && typeof response.json === 'function') {
    return response.status(status).json(payload);
  }

  response.statusCode = status;
  setHeader(response, 'Content-Type', 'application/json; charset=utf-8');
  const body = JSON.stringify(payload);
  if (typeof response.end === 'function') response.end(body);
  else response.body = body;
  return response;
}

export function sendError(response, error, requestId = randomUUID()) {
  const normalized = normalizeError(error);
  const message = normalized.expose
    ? normalized.message
    : 'An unexpected server error occurred.';

  return sendJson(response, normalized.status, {
    message,
    code: normalized.code,
    ...(normalized.fieldErrors ? { field_errors: normalized.fieldErrors } : {}),
    request_id: requestId,
  });
}
