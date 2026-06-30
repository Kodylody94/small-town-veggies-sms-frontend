import { ApiError } from './errors.js';

function required(name, value, minimumLength = 1) {
  const normalized = String(value ?? '').trim();
  if (normalized.length < minimumLength) {
    throw new ApiError(503, 'BACKEND_NOT_CONFIGURED', `${name} is not configured.`, {
      expose: false,
    });
  }
  return normalized;
}

function parseOrigin(value) {
  const normalized = required('APP_ORIGIN', value);
  let url;
  try {
    url = new URL(normalized);
  } catch (error) {
    throw new ApiError(503, 'BACKEND_NOT_CONFIGURED', 'APP_ORIGIN is invalid.', {
      cause: error,
      expose: false,
    });
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash) {
    throw new ApiError(503, 'BACKEND_NOT_CONFIGURED', 'APP_ORIGIN must be an origin only.', {
      expose: false,
    });
  }

  return url.origin;
}

export function readConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  return {
    production,
    appOrigin: parseOrigin(env.APP_ORIGIN),
    sessionSecret: required('SESSION_SECRET', env.SESSION_SECRET, 32),
    adminPasswordHash: required('ADMIN_PASSWORD_HASH', env.ADMIN_PASSWORD_HASH),
    sessionTtlSeconds: Number(env.SESSION_TTL_SECONDS || 8 * 60 * 60),
    allowSameSiteRequests: env.ALLOW_SAME_SITE_REQUESTS === 'true',
    runtimeMode: env.BACKEND_RUNTIME_MODE || (production ? 'production' : 'development'),
  };
}
