# Small Town Veggies API Contract

**Contract version:** 0.1.0-draft  
**Status:** Draft; live mutations and customer messaging remain disabled  
**Machine-readable specification:** [`openapi.yaml`](./openapi.yaml)

## Purpose

This contract fixes the data shapes, response behavior, security requirements, and order workflow expected by the Small Town Veggies dashboard. The frontend and backend must both conform to this document before live mutation mode is enabled.

## Compatibility rules

- The backend must send `Content-Type: application/json` for every JSON response.
- Successful collection responses should use `{ "data": [...], "meta": {...} }`.
- The frontend temporarily accepts a raw JSON array for collection routes during migration.
- Every record must be an object with a non-empty string or numeric `id`.
- Unknown fields may be ignored by the frontend, but existing fields may not change type without a contract-version change.
- Dates and timestamps must use ISO 8601. Date-time values must include a timezone offset or `Z`.
- Monetary values are JSON numbers in US dollars; they must be finite and non-negative.

## Authentication and session behavior

The dashboard uses a protected administrator session represented by a secure cookie.

Required cookie properties in production:

- `HttpOnly`
- `Secure`
- reviewed `SameSite` policy
- narrow path and domain scope
- short idle timeout and an absolute expiration

Every backend route must independently authenticate and authorize the current administrator. The frontend environment flag is not an authorization boundary.

Expected authorization responses:

| Status | Meaning | Frontend behavior |
| --- | --- | --- |
| `401` | No valid administrator session | Stop the operation and require sign-in |
| `403` | Valid session without permission | Display a non-retryable authorization error |

## Credentialed CORS and mutation protection

For a cross-origin deployment, the backend must:

- Return the exact allowlisted dashboard origin, never `*`.
- Return `Access-Control-Allow-Credentials: true`.
- Permit only required methods and headers.
- Validate `Origin` and Fetch Metadata before processing a mutation.
- Require JSON content types for mutation bodies.
- Require `X-Small-Town-Veggies-Request: dashboard`.
- Validate any session-bound CSRF token required by the final backend design.

The custom request header is deliberately non-simple so browsers perform a preflight. It is not a secret and must not be treated as authentication.

## Standard error response

All expected API errors should use:

```json
{
  "message": "The order cannot move from ready back to confirmed.",
  "code": "INVALID_ORDER_TRANSITION",
  "field_errors": {
    "status": "The requested transition is not allowed."
  },
  "request_id": "req_01J..."
}
```

`field_errors` and `request_id` are optional. `message` and `code` are required.

Recommended status mapping:

| Status | Use |
| --- | --- |
| `400` | Malformed request |
| `401` | Missing or expired session |
| `403` | Authenticated but unauthorized |
| `404` | Record not found |
| `409` | Invalid state transition or idempotency conflict |
| `422` | Schema or field validation failure |
| `429` | Rate limit exceeded |
| `500` | Unexpected server failure |
| `503` | Dependent service unavailable |

## Record contracts

### Order

Required:

- `id`: non-empty string or number
- `status`: `pending`, `confirmed`, `ready`, or `picked_up`

Supported display fields:

- `customer_name`: string, maximum 120 characters
- `pickup_day`: string, maximum 40 characters
- `total`: non-negative number
- `created_at`: ISO 8601 date-time
- `submitted_at`: ISO 8601 date-time
- `updated_at`: ISO 8601 date-time

The dashboard determines recency using `created_at`, then `submitted_at`, then `updated_at`. The backend should always provide `created_at`.

Allowed forward transitions:

```text
pending -> confirmed -> ready -> picked_up
```

The backend must reject skipped, reversed, repeated, or otherwise invalid transitions unless a documented idempotent replay returns the already-current record.

### Customer

Required:

- `id`: non-empty string or number
- `opted_in`: literal JSON boolean

Supported fields:

- `name`: string, maximum 120 characters
- `phone`: normalized E.164 phone number preferred
- `created_at`: ISO 8601 date-time or date
- `consent_updated_at`: ISO 8601 date-time
- `consent_source`: `web`, `sms`, `paper`, `staff`, or `unknown`

Consent is fail-closed:

- Only literal JSON `true` authorizes messaging.
- Literal `false` is opted out.
- Missing, string, numeric, or ambiguous consent is unknown and must not authorize messaging.
- The backend must re-check current consent immediately before every send.

### Product

Required:

- `id`: non-empty string or number
- `name`: non-empty string, maximum 80 characters
- `price`: number from `0` through `10000`
- `unit`: non-empty string, maximum 40 characters
- `active`: literal JSON boolean

Availability is fail-closed. Only literal JSON `true` means available.

## Endpoint behavior

### Read routes

| Method | Route | Response |
| --- | --- | --- |
| `GET` | `/api/orders` | Order collection |
| `GET` | `/api/customers` | Customer collection |
| `GET` | `/api/products` | Product collection |

Read routes must not mutate data and should support `ETag` or another reviewed caching strategy only if private customer data cannot be shared across sessions.

### Order transitions

| Method | Route | Required current state | Resulting state |
| --- | --- | --- | --- |
| `POST` | `/api/orders/{id}/confirm` | `pending` | `confirmed` |
| `POST` | `/api/orders/{id}/ready` | `confirmed` | `ready` |
| `POST` | `/api/orders/{id}/pickup` | `ready` | `picked_up` |

Each successful mutation should return `{ "data": <updated order> }`.

### Product creation

`POST /api/products`

Request:

```json
{
  "name": "Purple Hull Peas",
  "price": 25.5,
  "unit": "bucket"
}
```

The backend must normalize whitespace, validate all fields, set the initial availability explicitly, and return the created product.

### Broadcasts

`POST /api/broadcasts`

Request:

```json
{
  "message": "Fresh-picked vegetables are available today."
}
```

The backend must select recipients from current server-side consent records. A client-supplied recipient list must never bypass consent enforcement.

### Pickup reminders

`POST /api/reminders`

Request:

```json
{
  "order_ids": [1041, 1040]
}
```

The backend must verify that every order still exists, remains eligible, belongs to a message-authorized customer, and has not already received the same reminder within the protected deduplication window.

## Pagination

Collection endpoints should support:

- `limit`: integer from 1 through 100
- `cursor`: opaque server-generated cursor

Envelope example:

```json
{
  "data": [],
  "meta": {
    "next_cursor": null,
    "count": 0
  }
}
```

The frontend does not yet expose pagination controls. The backend may initially return all records only while the dataset remains safely bounded.

## Idempotency and audit requirements

Before live mutations are enabled:

- The backend must support replay-safe mutation handling.
- Duplicate button presses and network retries must not create duplicate records or messages.
- Every mutation must record administrator identity, operation, target, outcome, timestamp, request ID, and relevant before/after state.
- Sensitive customer data must not be written to application logs unnecessarily.

## Production acceptance gates

This contract is not complete until the following are demonstrated in staging:

1. Two administrators cannot exceed their assigned permissions.
2. Expired sessions receive `401` and cannot mutate data.
3. Disallowed origins and missing mutation headers are rejected before business logic runs.
4. Invalid order transitions return `409` without changing the order.
5. Invalid product input returns `422` with field errors.
6. Rate limits return `429` without partial processing.
7. Ambiguous customer consent never becomes message-authorized.
8. STOP/opt-out processing prevents subsequent sends.
9. Duplicate requests do not create duplicate mutations or messages.
10. Audit entries and database recovery procedures are verified.
