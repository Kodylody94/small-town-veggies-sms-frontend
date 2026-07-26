export const demoSession = Object.freeze({
  authenticated: true,
  administrator_id: 'demo',
  csrf_token: null,
  expires_at: null,
  demo: true,
});

export function normalizeSession(value) {
  if (!value || typeof value !== 'object' || value.authenticated !== true) return null;

  const demo = value.demo === true;
  const csrfToken =
    typeof value.csrf_token === 'string' && value.csrf_token.trim()
      ? value.csrf_token.trim().slice(0, 500)
      : null;
  const expiresAt =
    typeof value.expires_at === 'string' && value.expires_at.trim()
      ? value.expires_at.trim().slice(0, 100)
      : null;
  if (!demo && (!csrfToken || csrfToken.length < 20 || !expiresAt || !Number.isFinite(Date.parse(expiresAt)))) {
    return null;
  }

  const administratorId =
    (typeof value.administrator_id === 'string' ? value.administrator_id.trim() : '') ||
    (demo ? 'demo' : 'administrator');

  return {
    authenticated: true,
    administrator_id: administratorId.slice(0, 120),
    csrf_token: csrfToken,
    expires_at: expiresAt,
    demo,
  };
}
