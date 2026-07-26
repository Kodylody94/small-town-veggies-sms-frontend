import { describe, expect, it } from 'vitest';
import { readConfig } from '../_lib/config.js';
import { createRuntimeDependencies } from '../_lib/router.js';
import { parseCookies } from '../_lib/session.js';
import {
  UnconfiguredIdempotencyStore,
  UnconfiguredRateLimiter,
  UnconfiguredSessionStore,
} from '../_lib/stores.js';
import { validateProduct } from '../_lib/validation.js';

const CONFIG_ENV = {
  NODE_ENV: 'production',
  APP_ORIGIN: 'https://dashboard.example.com',
  SESSION_SECRET: 'session-secret-that-is-at-least-thirty-two-characters',
  ADMIN_PASSWORD_HASH: 'scrypt$16384$8$1$AA$BB',
};

describe('backend hardening', () => {
  it.each(['3600s', '0', '-1', '1.5', 'NaN'])(
    'rejects invalid session TTL value %s',
    (sessionTtlSeconds) => {
      expect(() =>
        readConfig({ ...CONFIG_ENV, SESSION_TTL_SECONDS: sessionTtlSeconds }),
      ).toThrowError(/SESSION_TTL_SECONDS must be a positive integer/);
    },
  );

  it('accepts a finite positive integer session TTL', () => {
    expect(readConfig({ ...CONFIG_ENV, SESSION_TTL_SECONDS: '3600' }).sessionTtlSeconds).toBe(
      3600,
    );
  });

  it('forces fail-closed stores whenever Node is running in production', () => {
    const dependencies = createRuntimeDependencies({
      NODE_ENV: 'production',
      BACKEND_RUNTIME_MODE: 'development',
    });

    expect(dependencies.sessionStore).toBeInstanceOf(UnconfiguredSessionStore);
    expect(dependencies.rateLimiter).toBeInstanceOf(UnconfiguredRateLimiter);
    expect(dependencies.idempotencyStore).toBeInstanceOf(UnconfiguredIdempotencyStore);
  });

  it('keeps parsing other cookies when one value has malformed escapes', () => {
    expect(parseCookies('legacy=100%; stv_admin_session=valid%2Etoken')).toEqual({
      legacy: '100%',
      stv_admin_session: 'valid.token',
    });
  });

  it.each([null, false, '', ' ', '25'])(
    'rejects coerced non-numeric product price %j',
    (price) => {
      expect(() => validateProduct({ name: 'Tomatoes', unit: 'bucket', price })).toThrowError(
        /invalid fields/,
      );
    },
  );

  it('accepts an actual finite numeric product price', () => {
    expect(validateProduct({ name: 'Tomatoes', unit: 'bucket', price: 25 })).toEqual({
      name: 'Tomatoes',
      unit: 'bucket',
      price: 25,
    });
  });
});
