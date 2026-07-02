# Small Town Veggies API Contract

**Contract version:** 0.3.0-draft  
**Status:** Sandbox public order submission is implemented; production storage, live administrator mutations, payments, inventory reservation, and customer messaging remain disabled  
**Machine-readable specification:** [`openapi.yaml`](./openapi.yaml)

## Purpose

This contract defines the data shapes, response behavior, security requirements, and order workflow used by the Small Town Veggies dashboard and its sandbox-only public order form. The frontend and backend must conform to this document before any production capability is enabled.

## Operating boundaries

The current public `/order` page and `POST /api/order-submissions` route are for controlled sandbox testing only.

They do not:

- collect or authorize payment;
- reserve produce or guarantee availability;
- send SMS messages or confirmations;
- create production records;
- enable the protected administrator dashboard mutations.

The upstream integration must remain configured for the 3Min API sandbox and must use a server-only collaboration key limited to record creation.

## Compatibility rules

- JSON responses use `Content-Type: application/json`.
- Successful collection responses use `{ "data": [...], "meta": {...} }`.
- Every returned record has a non-empty string or numeric `id`.
- Dates and timestamps use ISO 8601.
- Date-time values include a timezone offset or `Z`.
- Public pickup dates are date-only `YYYY-MM-DD` values evaluated in `America/Chicago`.
- Monetary values are finite, non-negative JSON numbers in US dollars.
- Unknown public-order request fields are discarded and never forwarded upstream.

## Authentication and session behavior

Protected dashboard routes use a secure administrator session represented by an `HttpOnly` cookie. Every protected route independently authenticates and authorizes the administrator.

Required production cookie properties:

- `HttpOnly`;
- `Secure`;
- reviewed `SameSite` policy;
- narrow path and domain scope;
- short idle timeout and absolute expiration.

Expected authorization responses:

| Status | Meaning |
| --- | --- |
| `401` | No valid administrator session |
| `403` | Origin, Fetch Metadata, request marker, CSRF, or authorization check failed |

The public sandbox order route does not use an administrator session or CSRF token. It has a separate same-origin security policy described below.

## Origin, request-marker, and mutation protection

All browser mutations require:

- the exact allowlisted `APP_ORIGIN`;
- an allowed Fetch Metadata site context;
- `Content-Type: application/json`;
- a route-specific `X-Small-Town-Veggies-Request` value;
- an `Idempotency-Key` where the operation can create or change business data.

Protected dashboard mutations use:

```http
X-Small-Town-Veggies-Request: dashboard
X-CSRF-Token: <session-bound token>
Idempotency-Key: <unique value>
```

Public sandbox order submissions use:

```http
X-Small-Town-Veggies-Request: order-form
Idempotency-Key: <unique value>
```

The request marker is not a secret and must never be treated as authentication. Its purpose is to force a browser preflight and separate the public order form from administrator mutations.

## Standard error response

Expected API errors use:

```json
{
  "message": "The request contains invalid fields.",
  "code": "VALIDATION_FAILED",
  "field_errors": {
    "pickup_date": "Choose a valid pickup date within the next 60 days in America/Chicago."
  },
  "request_id": "0d132cd4-e6b0-4dc0-a1fb-3c96e3e8587c"
}
```

`field_errors` is optional. `message`, `code`, and `request_id` are required by the machine-readable contract.

| Status | Use |
| --- | --- |
| `400` | Malformed request or invalid idempotency key |
| `401` | Missing or expired administrator session |
| `403` | Origin, marker, Fetch Metadata, CSRF, or authorization failure |
| `404` | Record not found |
| `409` | Invalid state transition or idempotency conflict |
| `415` | Mutation did not use JSON |
| `422` | Schema or field validation failure |
| `429` | Rate limit exceeded |
| `502` | Sandbox provider rejected the request or returned an invalid response |
| `503` | Required configuration, durable adapter, or sandbox provider unavailable |

Provider response bodies, API keys, authorization headers, and other upstream details must not be copied into browser error responses.

## Public sandbox order submission

### Route

`POST /api/order-submissions`

### Request headers

```http
Content-Type: application/json
X-Small-Town-Veggies-Request: order-form
Idempotency-Key: <16-200 characters>
```

### Request body

```json
{
  "customer_name": "Sandbox Customer",
  "phone": "601-555-0147",
  "bucket_price": 30,
  "quantity": 1,
  "pickup_date": "2026-07-03",
  "notes": "Sandbox verification only."
}
```

Validation rules:

- `customer_name`: required text, maximum 120 characters;
- `phone`: valid 10-digit US number, normalized server-side to E.164;
- `bucket_price`: exactly `25`, `30`, or `35`;
- `quantity`: integer from `1` through `5`;
- `pickup_date`: a real calendar date from the current `America/Chicago` business date through 60 days later, inclusive;
- `notes`: optional text, maximum 500 characters.

The server calculates `total` and constructs the upstream payload. Client-supplied values cannot override:

- `pickup_location: "Small Town Veggies Ovett"`;
- `payment_status: "unpaid"`;
- `order_status: "received"`;
- the item name and calculated total;
- the server creation timestamp.

### Successful response

The 3Min API contract is asynchronous. Only an upstream HTTP `202` with a non-empty record ID is accepted as success.

```json
{
  "data": {
    "id": "sandbox-record-id",
    "status": "received",
    "customer_name": "Sandbox Customer",
    "total": 30,
    "pickup_date": "2026-07-03",
    "pickup_location": "Small Town Veggies Ovett",
    "submitted_at": "2026-07-02T18:00:00.000Z"
  }
}
```

### Sandbox upstream controls

The server must:

- require `ENABLE_PUBLIC_ORDER_SUBMISSIONS=true`;
- require `THREE_MIN_API_ENVIRONMENT=sandbox`;
- require an HTTPS URL on `api.3minapi.com` under `/api/v1/data/{endpoint}`;
- reject URL credentials, custom ports, query strings, fragments, and other hosts or paths;
- require a sandbox test key;
- keep the key in a server-only variable;
- abort slow upstream requests;
- accept only HTTP `202` plus a record ID;
- normalize network, timeout, provider, and malformed-response failures without disclosing secrets.

### Required server-only environment variables

| Variable | Purpose |
| --- | --- |
| `APP_ORIGIN` | Exact browser origin accepted for the order form and dashboard |
| `ENABLE_PUBLIC_ORDER_SUBMISSIONS` | Explicit sandbox order-form enable switch |
| `THREE_MIN_API_ENVIRONMENT` | Must remain `sandbox` in this stage |
| `THREE_MIN_API_URL` | Approved Small Town Veggies 3Min data endpoint |
| `THREE_MIN_API_SANDBOX_KEY` | Create-only sandbox collaboration key |

None of these provider settings may use a `VITE_` prefix. The sandbox key must never be committed to GitHub or returned to the browser.

The protected administrator routes separately require their documented session and password-hash configuration.

### Sandbox durability limitation

Public rate-limit and idempotency stores are currently in-memory. They are suitable for controlled sandbox verification only and do not provide cross-instance durability in serverless production. Production activation requires durable shared stores and a reviewed abuse-prevention design.

## Record contracts

### Order

Required:

- `id`: non-empty string or number;
- `status`: `pending`, `confirmed`, `ready`, or `picked_up`.

Supported display fields include `customer_name`, `pickup_day`, `total`, `created_at`, `submitted_at`, and `updated_at`.

Allowed forward transitions:

```text
pending -> confirmed -> ready -> picked_up
```

Skipped, reversed, repeated, or otherwise invalid transitions are rejected unless a documented idempotent replay returns the already-current record.

### Customer

Required:

- `id`: non-empty string or number;
- `opted_in`: literal JSON boolean.

Consent is fail-closed. Only literal `true` authorizes messaging. Missing, string, numeric, or ambiguous values must never authorize messaging. Consent must be rechecked immediately before every send.

### Product

Required:

- `id`: non-empty string or number;
- `name`: non-empty string, maximum 80 characters;
- `price`: number from `0` through `10000`;
- `unit`: non-empty string, maximum 40 characters;
- `active`: literal JSON boolean.

Availability is fail-closed. Only literal `true` means available.

## Protected endpoint behavior

### Read routes

| Method | Route | Response |
| --- | --- | --- |
| `GET` | `/api/orders` | Order collection |
| `GET` | `/api/customers` | Customer collection |
| `GET` | `/api/products` | Product collection |

### Order transitions

| Method | Route | Required current state | Resulting state |
| --- | --- | --- | --- |
| `POST` | `/api/orders/{id}/confirm` | `pending` | `confirmed` |
| `POST` | `/api/orders/{id}/ready` | `confirmed` | `ready` |
| `POST` | `/api/orders/{id}/pickup` | `ready` | `picked_up` |

### Product creation

`POST /api/products` normalizes whitespace, validates all fields, explicitly sets initial availability, and returns the created product.

### Broadcasts and reminders

`POST /api/broadcasts` and `POST /api/reminders` remain disabled. Recipient selection must eventually occur server-side from current consent records; client-supplied recipients can never bypass consent enforcement.

## Pagination

Collection endpoints should support `limit` from 1 through 100 and an opaque server-generated `cursor`. The frontend does not yet expose pagination controls.

## Idempotency, rate limiting, and audit requirements

- Duplicate button presses and network retries must not create duplicate mutations.
- Public and protected mutation paths use separate rate-limit and idempotency namespaces.
- Every mutation records operation, target where available, outcome, actor class, timestamp, and request ID.
- Sensitive customer data and secrets must not be written to logs unnecessarily.

## Production acceptance gates

Production is not approved until all applicable gates are demonstrated in staging:

1. Durable shared session, rate-limit, and idempotency stores are connected.
2. Expired administrator sessions receive `401` and cannot mutate data.
3. Disallowed origins and incorrect request markers are rejected before business logic.
4. Public duplicate submissions are replay safe across instances.
5. Invalid order transitions return `409` without changing records.
6. Invalid public and product input returns `422` with field errors.
7. Rate limits return `429` without partial processing.
8. Provider failures never disclose keys or upstream payloads.
9. Ambiguous customer consent never becomes message-authorized.
10. STOP/opt-out processing prevents subsequent sends.
11. Audit records and recovery procedures are verified.
12. Payments, inventory reservation, and messaging receive separate end-to-end approval.
