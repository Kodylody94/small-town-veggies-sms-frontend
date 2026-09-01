# Base44 Dev Environment

## Architecture

- **Frontend**: Vite + React 19 dev server (port 5173, mapped to host 3000). Uses Tailwind CSS v4 via `@tailwindcss/vite`.
- **Backend**: Node.js API in `api/` — a Vercel-style serverless handler (`api/router.js`) wrapped by `api/dev-server.mjs` as a plain `http.createServer` (internal port 3001).
- **Single origin**: The Vite dev server proxies `/api` to the `api` compose service. The frontend uses `VITE_API_URL=same-origin`, so all API calls go through the same origin — no CORS issues.

## Running

```bash
docker compose -f docker-compose.base44.yml up -d --build
```

The app is live at host port 3000. The API health check is at `http://localhost:3001/health` (internal).

## Demo mode

The frontend runs in **demo mode** (`VITE_ENABLE_DEMO_DATA=true`): it uses in-memory sample data for orders, customers, and products. Login is automatic (demo session). Mutations are blocked in the UI.

The `/order` page makes a real API call to the backend even in demo mode. With `ENABLE_PUBLIC_ORDER_SUBMISSIONS=false` (default), the backend returns a 503 and the form shows an error — this is expected.

## Enabling sandbox order submissions (optional)

Requires two external credentials from the 3Min API provider:
- `THREE_MIN_API_SANDBOX_KEY` — sandbox key starting with `tm_test_`
- `THREE_MIN_API_URL` — `https://api.3minapi.com/api/v1/data/<dataset_id>`

Set `ENABLE_PUBLIC_ORDER_SUBMISSIONS=true` and provide both via the Base44 secrets dashboard. Do NOT put these in frontend env vars.

## Key env vars

| Variable | Purpose | Source |
|---|---|---|
| `VITE_API_URL` | Frontend API base URL (`same-origin` = proxy via Vite) | `.env.base44-defaults` |
| `VITE_ENABLE_DEMO_DATA` | Use in-memory demo data | `.env.base44-defaults` |
| `APP_ORIGIN` | Browser origin for backend security checks | compose `environment:` (dynamic) |
| `SESSION_SECRET` | Session token signing (≥32 chars) | `.env.base44-defaults` |
| `ADMIN_PASSWORD_HASH` | Admin login password hash (scrypt) | `.env.base44-defaults` |
| `BACKEND_RUNTIME_MODE` | `development` = in-memory stores | `.env.base44-defaults` |

## Tests

```bash
npm test          # unit + backend contract tests (vitest)
npm run test:e2e  # playwright browser tests
npm run lint      # eslint
```
