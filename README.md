# Small Town Veggies SMS Frontend

Responsive React dashboard for Small Town Veggies order fulfillment, product availability, customer consent, updates, and pickup reminders.

## Safety modes

The dashboard uses three explicit operating states:

1. **Demo mode** — active when `VITE_API_URL` is missing or `VITE_ENABLE_DEMO_DATA=true`. It uses defensive copies of normalized sample records and blocks every mutation.
2. **Live read-only mode** — active when a backend URL is configured but `VITE_ENABLE_LIVE_MUTATIONS=false`. Live records may be viewed, but order and product changes remain locked.
3. **Live mutation mode** — active only when `VITE_ENABLE_LIVE_MUTATIONS=true`. Enable this only after the production safeguards below have been verified.

Customer broadcast and reminder delivery remain disabled in the interface until their protected backend workflows receive a separate end-to-end verification. The interface never claims that an SMS was sent when no delivery occurred.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Start safely with:

```env
VITE_API_URL=https://your-backend.example.com
VITE_ENABLE_DEMO_DATA=true
VITE_ENABLE_LIVE_MUTATIONS=false
```

For protected live read-only data, set `VITE_ENABLE_DEMO_DATA=false` and keep mutations disabled. Do not place provider credentials, administrator secrets, CSRF secrets, or long-lived API keys in frontend environment variables.

The API client sends cookies with `credentials: include`, applies a 15-second timeout, validates collection and record shapes, avoids unnecessary JSON preflights on GET requests, and rejects malformed response bodies.

## Data contract

Collection routes may return a raw array or an envelope shaped like `{ "data": [...] }`. Every record must be an object with a non-empty string or numeric `id`.

Safety-sensitive booleans are intentionally strict:

- A customer is message-authorized only when `opted_in` is the literal JSON boolean `true`.
- Literal `false` is displayed as opted out.
- Missing, string, numeric, or otherwise ambiguous consent is displayed as **Unknown — do not message**.
- A product is available only when `active` is the literal JSON boolean `true`.
- Missing or ambiguous availability is treated as unavailable.
- Unsupported order statuses normalize to `unknown` and cannot trigger a status mutation.

Order recency uses `created_at`, then `submitted_at`, then `updated_at`. Numeric or string IDs are only a final deterministic fallback when no valid timestamp is available.

## Expected backend routes

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/orders` | List orders |
| POST | `/api/orders/:id/confirm` | Confirm an order |
| POST | `/api/orders/:id/ready` | Mark an order ready |
| POST | `/api/orders/:id/pickup` | Mark an order picked up |
| GET | `/api/customers` | List customers and consent state |
| GET | `/api/products` | List products |
| POST | `/api/products` | Add a validated product |
| POST | `/api/broadcasts` | Submit an opted-in customer update after backend verification |
| POST | `/api/reminders` | Submit reminders for selected order IDs after backend verification |

## Credentialed mutation contract

Every frontend mutation includes:

```http
Content-Type: application/json
X-Small-Town-Veggies-Request: dashboard
```

The custom header is not a secret. It intentionally forces a browser preflight. The backend must reject a mutation unless all of these checks pass:

- The administrator session is authenticated and authorized for the requested record.
- `Origin` matches an exact allowlisted dashboard origin.
- Credentialed CORS returns that exact origin, never `*`.
- `Sec-Fetch-Site` is `same-origin` or an explicitly reviewed `same-site` case.
- `Content-Type` is an allowed JSON media type.
- `X-Small-Town-Veggies-Request` is exactly `dashboard`.
- Any session-bound CSRF token required by the backend is present and valid.
- The requested state transition is valid, idempotent, rate-limited, and audit logged.

The frontend mutation flag is only an interface safety lock. It is not authentication, authorization, or a security boundary.

## Quality checks

```bash
npm run lint
npm test
npm run build
```

GitHub Actions runs all three checks with cancellation for superseded runs and a ten-minute job timeout. The committed dependency lock is installed with `npm ci`.

The current tests cover formatting and validation utilities, strict API record contracts, timestamp-based ordering, stale reminder-selection pruning, defensive demo copies, mutation locking, and mutation request headers. Browser-level route, keyboard, API-error, and end-to-end tests are still required before production activation.

## Vercel deployment

1. Import this GitHub repository into Vercel.
2. Add `VITE_API_URL` with the public HTTPS backend URL.
3. Set `VITE_ENABLE_DEMO_DATA=false` only when the protected backend is ready.
4. Keep `VITE_ENABLE_LIVE_MUTATIONS=false` through read-only production verification.
5. Keep customer broadcasts and reminder delivery disconnected.
6. Deploy and verify every response security header defined in `vercel.json`.
7. Run the complete read-only and mutation test plans before changing either safety gate.

The committed CSP uses `connect-src 'self'`, so it fails closed and blocks cross-origin API connections by default. Prefer a reviewed same-origin API or reverse proxy. If the final backend must remain cross-origin, replace that directive with only `'self'` plus the exact HTTPS backend origin before deployment; never restore a wildcard or general `https:` source.

## Required production safeguards

- Administrator authentication and authorization on every backend route
- Secure, `HttpOnly`, `SameSite`, HTTPS-only session cookies or another reviewed authentication design
- Restricted credentialed CORS matching the exact dashboard domain
- Origin, Fetch Metadata, custom-header, and CSRF-token enforcement for mutations
- Server-side SMS consent enforcement immediately before each send
- STOP and opt-out handling that cannot be bypassed by the frontend
- Rate limiting, idempotency protection, and audit logs for all mutations
- Server-side schema validation and normalized error responses
- Secrets stored only on the server
- Database backups and recovery testing
- End-to-end tests for order transitions, product creation, and the Android SMS gateway
- A verified test reply and delivery receipt before any live customer messaging
