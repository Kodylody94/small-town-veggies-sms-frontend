import { describe, expect, it } from 'vitest';
import { normalizeSession } from '../auth';

describe('administrator session normalization', () => {
  it('accepts a valid authenticated session', () => {
    expect(
      normalizeSession({
        authenticated: true,
        administrator_id: ' owner ',
        csrf_token: ' csrf-token-that-is-long-enough ',
        expires_at: '2026-07-01T12:00:00Z',
      }),
    ).toEqual({
      authenticated: true,
      administrator_id: 'owner',
      csrf_token: 'csrf-token-that-is-long-enough',
      expires_at: '2026-07-01T12:00:00Z',
      demo: false,
    });
  });

  it('rejects unauthenticated or malformed session payloads', () => {
    expect(normalizeSession(null)).toBeNull();
    expect(normalizeSession({ authenticated: false, administrator_id: 'owner' })).toBeNull();
    expect(normalizeSession({ authenticated: true, administrator_id: '' })).toBeNull();
  });

  it('uses a safe administrator label when the backend omits a display identifier', () => {
    expect(
      normalizeSession({
        authenticated: true,
        csrf_token: 'csrf-token-that-is-long-enough',
        expires_at: '2026-07-01T12:00:00Z',
      })?.administrator_id,
    ).toBe('administrator');
  });
});
