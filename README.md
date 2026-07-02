# Small Town Veggies SMS Frontend

Responsive React dashboard for Small Town Veggies order fulfillment, product availability, customer consent, updates, and pickup reminders.

## Safety modes

The dashboard uses three explicit operating states:

1. **Demo mode** — active when `VITE_API_URL` is missing or `VITE_ENABLE_DEMO_DATA=true`. It uses defensive copies of normalized sample records and blocks every mutation.
2. **Live read-only mode** — active when a backend URL is configured but `VITE_ENABLE_LIVE_MUTATIONS=false`. Live records may be viewed, but order and product changes remain locked.
3. **Live mutation mode** — active only when `VITE_ENABLE_LIVE_MUTATIONS=true`. Enable this only after the production safeguards below have been verified.

Customer broadcast and reminder delivery remain disabled in the interface until their protected backend workflows receive a separate end-to-end verification. The interface never claims that an SMS was sent when no delivery occurred.

## Sandbox public order form

The `/order` page submits test bucket requests through `POST /api/order-submissions`. The server validates and normalizes the request, calculates the total, fixes the pickup location and initial statuses, and forwards an allowlisted payload to the 3Min API sandbox.

This route is for controlled testing only. It does not collect payment, reserve inventory, guarantee produce availability, send SMS, or create production records. Pickup dates are evaluated as date-only values in `America/Chicago`, from the current Central Time business date through 60 days later, inclusive.

The browser sends the distinct request marker `order-form` and an idempotency key to the same-origin backend. The upstream provider credential remains server-only. Full request, response, environment, error, and sandbox durability requirements are documented in [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md).

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

## Formal API contract

The frontend/backend agreement is versioned in:

- [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) — human-readable security, schema, error, workflow, consent, sandbox, and acceptance requirements
- [`docs/openapi.yaml`](docs/openapi.yaml) — machine-readable OpenAPI 3.1 contract

The contract remains a draft until the protected backend and staging acceptance gates are demonstrated.

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
| POST | `/api/order-submissions` | Submit a sandbox-only public order request |
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

Every protected dashboard mutation includes:

```http
Content-Type: application/json
X-Small-Town-Veggies-Request: dashboard
```

Public sandbox order submissions use:

```http
Content-Type: application/json
X-Small-Town-Veggies-Request: order-form
Idempotency-Key: <unique value>
```

The custom request header is not a secret. It intentionally forces a browser preflight. The backend must reject a mutation unless all applicable origin, Fetch Metadata, JSON, session, CSRF, idempotency, rate-limit, and validation checks pass.

The frontend mutation flag is only an interface safety lock. It is not authentication, authorization, or a security boundary.

## Quality checks

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

The application dependency graph remains reproducible through `npm ci` and the committed lockfile. The browser command pins `@playwright/test` to version `1.55.0`; GitHub Actions installs the matching Chromium runtime before executing the suite.

Current automated coverage includes:

- Formatting and product validation utilities
- Strict API record contracts
- Timestamp-based order ordering
- Central Time date-only pickup boundaries and invalid calendar dates
- Public order validation, idempotency, and request headers
- 3Min gateway configuration, URL allowlisting, timeout, network, provider response, and secret non-disclosure behavior
- Stale reminder-selection pruning
- Defensive demo copies and mutation locks
- Live read-only dashboard rendering
- Fail-closed customer consent and product availability in a real browser
- Normalized authorization-error presentation
- Mobile navigation focus containment, inert background behavior, and focus restoration

GitHub Actions runs the locked application checks first, followed by the Chromium browser suite. Browser traces, screenshots, and the HTML report are retained as short-lived artifacts when the browser job fails.

## Vercel deployment

1. Import this GitHub repository into Vercel.
2. Add `VITE_API_URL` with the public HTTPS backend URL.
3. Configure the server-only sandbox order settings documented in the API contract.
4. Set the exact preview origin accepted by the backend.
5. Keep `VITE_ENABLE_DEMO_DATA=true` and `VITE_ENABLE_LIVE_MUTATIONS=false` while verifying `/order`.
6. Submit a clearly labeled test request and confirm its record ID in 3Min API sandbox logs.
7. Confirm no provider credential appears in page source, browser bundles, or response bodies.
8. Keep customer broadcasts and reminder delivery disconnected.
9. Deploy and verify every response security header defined in `vercel.json`.

The committed CSP uses `connect-src 'self'`, so browser API traffic remains same-origin and the server performs the upstream provider request.

## Required production safeguards

- Administrator authentication and authorization on every backend route
- Secure, `HttpOnly`, `SameSite`, HTTPS-only session cookies or another reviewed authentication design
- Restricted credentialed CORS matching the exact dashboard domain
- Origin, Fetch Metadata, custom-header, and CSRF-token enforcement for mutations
- Durable shared rate-limit and idempotency stores
- Server-side SMS consent enforcement immediately before each send
- STOP and opt-out handling that cannot be bypassed by the frontend
- Rate limiting, idempotency protection, and audit logs for all mutations
- Server-side schema validation and normalized error responses
- Secrets stored only on the server
- Database backups and recovery testing
- End-to-end tests for order transitions, product creation, and the Android SMS gateway
- A verified test reply and delivery receipt before any live customer messaging
