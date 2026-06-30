import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { ApiError } from './errors.js';

export const SESSION_COOKIE_NAME = 'stv_admin_session';

function sign(value, secret) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left ?? ''));
  const rightBuffer = Buffer.from(String(right ?? ''));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createSessionToken({ secret, ttlSeconds, now = Date.now(), subject = 'admin' }) {
  const issuedAt = Math.floor(now / 1000);
  const payload = {
    sub: subject,
    iat: issuedAt,
    exp: issuedAt + ttlSeconds,
    csrf: randomBytes(24).toString('base64url'),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return {
    token: `${encodedPayload}.${sign(encodedPayload, secret)}`,
    payload,
  };
}

export function verifySessionToken(token, secret, now = Date.now()) {
  const [encodedPayload, signature] = String(token ?? '').split('.');
  if (!encodedPayload || !signature || !safeEqual(signature, sign(encodedPayload, secret))) {
    throw new ApiError(401, 'INVALID_SESSION', 'The administrator session is invalid.');
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch (error) {
    throw new ApiError(401, 'INVALID_SESSION', 'The administrator session is invalid.', { cause: error });
  }

  const currentTime = Math.floor(now / 1000);
  if (
    payload?.sub !== 'admin' ||
    !Number.isInteger(payload.iat) ||
    !Number.isInteger(payload.exp) ||
    payload.exp <= currentTime ||
    typeof payload.csrf !== 'string' ||
    payload.csrf.length < 20
  ) {
    throw new ApiError(401, 'SESSION_EXPIRED', 'The administrator session has expired.');
  }

  return payload;
}

export function parseCookies(header) {
  return String(header ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separator = part.indexOf('=');
      if (separator < 1) return cookies;
      cookies[part.slice(0, separator)] = decodeURIComponent(part.slice(separator + 1));
      return cookies;
    }, {});
}

export function sessionCookie(token, { production, ttlSeconds }) {
  return [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    production ? 'Secure' : null,
    `Max-Age=${ttlSeconds}`,
  ]
    .filter(Boolean)
    .join('; ');
}

export function expiredSessionCookie({ production }) {
  return [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    production ? 'Secure' : null,
    'Max-Age=0',
  ]
    .filter(Boolean)
    .join('; ');
}
