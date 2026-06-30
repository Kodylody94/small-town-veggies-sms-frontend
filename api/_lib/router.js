import { randomUUID } from 'node:crypto';
import { readConfig } from './config.js';
import { ApiError } from './errors.js';
import { getHeader, readJson, requestPath, sendError, sendJson, setHeader } from './http.js';
import { verifyPassword } from './password.js';
import {
  createSessionToken,
  expiredSessionCookie,
  parseCookies,
  SESSION_COOKIE_NAME,
  sessionCookie,
  verifySessionToken,
} from './session.js';
import {
  applyCors,
  handlePreflight,
  requireMutationSecurity,
} from './security.js';
import {
  ConsoleAuditStore,
  MemoryIdempotencyStore,
  MemoryRateLimiter,
  MemorySessionStore,
  UnconfiguredIdempotencyStore,
  UnconfiguredRateLimiter,
  UnconfiguredRepository,
  UnconfiguredSessionStore,
} from './stores.js';
import { validateIdempotencyKey, validateLogin, validateProduct } from './validation.js';

function clientKey(request) {
  return (getHeader(request, 'x-forwarded-for').split(',')[0] || getHeader(request, 'x-real-ip') || 'unknown').trim();
}

function requireMethod(request, expected) {
  const method = String(request.method || 'GET').toUpperCase();
  if (method !== expected) {
    throw new ApiError(405, 'METHOD_NOT_ALLOWED', `This route requires ${expected}.`);
  }
}

async function requireSession(request, config, now, sessionStore) {
  const cookies = parseCookies(getHeader(request, 'cookie'));
  const payload = verifySessionToken(cookies[SESSION_COOKIE_NAME], config.sessionSecret, now());
  await sessionStore.requireActive(payload.sid);
  return payload;
}

async function audit(store, entry) {
  try {
    await store.write(entry);
  } catch (error) {
    console.error('Audit write failed', error);
  }
}

function collection(data) {
  return { data, meta: { next_cursor: null, count: data.length } };
}

function transitionDefinition(action) {
  const transitions = {
    confirm: ['pending', 'confirmed'],
    ready: ['confirmed', 'ready'],
    pickup: ['ready', 'picked_up'],
  };
  return transitions[action];
}

export function createRuntimeDependencies(env = process.env) {
  const productionRuntime = (env.BACKEND_RUNTIME_MODE || (env.NODE_ENV === 'production' ? 'production' : 'development')) === 'production';
  return {
    getConfig: () => readConfig(env),
    repository: new UnconfiguredRepository(),
    sessionStore: productionRuntime
      ? new UnconfiguredSessionStore()
      : new MemorySessionStore(),
    rateLimiter: productionRuntime ? new UnconfiguredRateLimiter() : new MemoryRateLimiter(),
    idempotencyStore: productionRuntime
      ? new UnconfiguredIdempotencyStore()
      : new MemoryIdempotencyStore(),
    auditStore: new ConsoleAuditStore(),
    now: () => Date.now(),
  };
}

export function createBackendHandler(dependencies) {
  const deps = {
    now: () => Date.now(),
    auditStore: new ConsoleAuditStore(),
    sessionStore: new UnconfiguredSessionStore(),
    ...dependencies,
  };

  return async function backendHandler(request, response) {
    const requestId = randomUUID();
    const path = requestPath(request);
    const method = String(request.method || 'GET').toUpperCase();
    setHeader(response, 'Cache-Control', 'no-store');
    setHeader(response, 'X-Request-ID', requestId);

    let config;
    let session;

    try {
      if (path === '/health' && method === 'GET') {
        let configured = true;
        try {
          (deps.getConfig ? deps.getConfig() : deps.config);
        } catch {
          configured = false;
        }
        return sendJson(response, 200, {
          data: {
            status: 'ok',
            configured,
            database: 'not_connected',
            session_store: 'not_connected',
            live_mutations: false,
            messaging: 'disabled',
          },
        });
      }

      config = deps.getConfig ? deps.getConfig() : deps.config;
      if (!config) {
        throw new ApiError(503, 'BACKEND_NOT_CONFIGURED', 'Backend configuration is unavailable.', {
          expose: false,
        });
      }
      applyCors(request, response, config);

      if (method === 'OPTIONS') return handlePreflight(request, response, config);

      if (path === '/auth/login') {
        requireMethod(request, 'POST');
        requireMutationSecurity(request, config);
        await deps.rateLimiter.consume(`login:${clientKey(request)}`);
        const { password } = validateLogin(await readJson(request));

        if (!verifyPassword(password, config.adminPasswordHash)) {
          await audit(deps.auditStore, {
            request_id: requestId,
            operation: 'admin.login',
            outcome: 'denied',
            actor: 'anonymous',
            timestamp: new Date(deps.now()).toISOString(),
          });
          throw new ApiError(401, 'INVALID_CREDENTIALS', 'The administrator credentials are invalid.');
        }

        const created = createSessionToken({
          secret: config.sessionSecret,
          ttlSeconds: config.sessionTtlSeconds,
          now: deps.now(),
        });
        await deps.sessionStore.create({
          id: created.payload.sid,
          subject: created.payload.sub,
          createdAt: created.payload.iat * 1000,
          expiresAt: created.payload.exp * 1000,
          revokedAt: null,
        });
        setHeader(response, 'Set-Cookie', sessionCookie(created.token, config));
        await audit(deps.auditStore, {
          request_id: requestId,
          operation: 'admin.login',
          outcome: 'success',
          actor: created.payload.sub,
          timestamp: new Date(deps.now()).toISOString(),
        });
        return sendJson(response, 200, {
          data: {
            authenticated: true,
            csrf_token: created.payload.csrf,
            expires_at: new Date(created.payload.exp * 1000).toISOString(),
          },
        });
      }

      if (path === '/auth/session') {
        requireMethod(request, 'GET');
        session = await requireSession(request, config, deps.now, deps.sessionStore);
        return sendJson(response, 200, {
          data: {
            authenticated: true,
            csrf_token: session.csrf,
            expires_at: new Date(session.exp * 1000).toISOString(),
          },
        });
      }

      if (path === '/auth/logout') {
        requireMethod(request, 'POST');
        session = await requireSession(request, config, deps.now, deps.sessionStore);
        requireMutationSecurity(request, config, { csrfToken: session.csrf });
        await deps.sessionStore.revoke(session.sid);
        setHeader(response, 'Set-Cookie', expiredSessionCookie(config));
        await audit(deps.auditStore, {
          request_id: requestId,
          operation: 'admin.logout',
          outcome: 'success',
          actor: session.sub,
          timestamp: new Date(deps.now()).toISOString(),
        });
        return sendJson(response, 200, { data: { authenticated: false } });
      }

      session = await requireSession(request, config, deps.now, deps.sessionStore);

      if (path === '/orders' && method === 'GET') {
        return sendJson(response, 200, collection(await deps.repository.listOrders()));
      }

      if (path === '/customers' && method === 'GET') {
        return sendJson(response, 200, collection(await deps.repository.listCustomers()));
      }

      if (path === '/products' && method === 'GET') {
        return sendJson(response, 200, collection(await deps.repository.listProducts()));
      }

      const transitionMatch = path.match(/^\/orders\/([^/]+)\/(confirm|ready|pickup)$/);
      if (transitionMatch) {
        requireMethod(request, 'POST');
        requireMutationSecurity(request, config, { csrfToken: session.csrf });
        await deps.rateLimiter.consume(`mutation:${session.sub}:${clientKey(request)}`);
        const idempotencyKey = validateIdempotencyKey(getHeader(request, 'idempotency-key'));
        const id = decodeURIComponent(transitionMatch[1]);
        const [expectedStatus, nextStatus] = transitionDefinition(transitionMatch[2]);

        const updated = await deps.idempotencyStore.execute(
          `${session.sub}:${path}:${idempotencyKey}`,
          () => deps.repository.transitionOrder(id, expectedStatus, nextStatus),
        );
        await audit(deps.auditStore, {
          request_id: requestId,
          operation: `order.${transitionMatch[2]}`,
          target: String(id),
          outcome: 'success',
          actor: session.sub,
          timestamp: new Date(deps.now()).toISOString(),
        });
        return sendJson(response, 200, { data: updated });
      }

      if (path === '/products') {
        requireMethod(request, 'POST');
        requireMutationSecurity(request, config, { csrfToken: session.csrf });
        await deps.rateLimiter.consume(`mutation:${session.sub}:${clientKey(request)}`);
        const idempotencyKey = validateIdempotencyKey(getHeader(request, 'idempotency-key'));
        const product = validateProduct(await readJson(request));
        const created = await deps.idempotencyStore.execute(
          `${session.sub}:${path}:${idempotencyKey}`,
          () => deps.repository.createProduct(product),
        );
        await audit(deps.auditStore, {
          request_id: requestId,
          operation: 'product.create',
          target: String(created.id),
          outcome: 'success',
          actor: session.sub,
          timestamp: new Date(deps.now()).toISOString(),
        });
        return sendJson(response, 201, { data: created });
      }

      if (path === '/broadcasts' || path === '/reminders') {
        requireMethod(request, 'POST');
        requireMutationSecurity(request, config, { csrfToken: session.csrf });
        throw new ApiError(503, 'MESSAGING_DISABLED', 'Customer messaging is not connected or enabled.');
      }

      throw new ApiError(404, 'ROUTE_NOT_FOUND', 'The requested API route was not found.');
    } catch (error) {
      await audit(deps.auditStore, {
        request_id: requestId,
        operation: `${method} ${path}`,
        outcome: 'failure',
        actor: session?.sub || 'anonymous',
        code: error?.code || 'INTERNAL_ERROR',
        timestamp: new Date(deps.now()).toISOString(),
      });
      return sendError(response, error, requestId);
    }
  };
}
