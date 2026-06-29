# Small Town Veggies SMS Frontend

Responsive React dashboard for Small Town Veggies order fulfillment, product availability, customer consent, updates, and pickup reminders.

## Current safety behavior

The repository starts in visibly labeled **demo mode** when `VITE_API_URL` is missing or `VITE_ENABLE_DEMO_DATA=true`. Demo mode uses sample read-only records and disables every action that would change data.

Customer update and reminder delivery are intentionally disabled in this foundation until the protected backend endpoints are verified. The interface does not claim that a message was sent when no live delivery occurred.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set these values in `.env.local`:

```env
VITE_API_URL=https://your-backend.example.com
VITE_ENABLE_DEMO_DATA=false
```

Do not place provider credentials or other secrets in frontend environment variables.

## Expected backend routes

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/orders` | List orders |
| POST | `/api/orders/:id/confirm` | Confirm an order |
| POST | `/api/orders/:id/ready` | Mark an order ready |
| POST | `/api/orders/:id/pickup` | Mark an order picked up |
| GET | `/api/customers` | List customers and consent state |
| GET | `/api/products` | List products |
| POST | `/api/products` | Add a product |
| POST | `/api/broadcasts` | Submit an opted-in customer update after backend verification |
| POST | `/api/reminders` | Submit reminders for selected order IDs after backend verification |

The frontend accepts either a raw JSON array/object or an envelope shaped like `{ "data": ... }`.

## Quality checks

```bash
npm run lint
npm test
npm run build
```

GitHub Actions runs all three checks on pull requests and relevant branch pushes.

## Vercel deployment

1. Import this GitHub repository into Vercel.
2. Add `VITE_API_URL` with the public HTTPS backend URL.
3. Add `VITE_ENABLE_DEMO_DATA=false` only after the backend is ready.
4. Deploy.

`vercel.json` rewrites client-side routes to `index.html`, so direct visits to pages such as `/orders` work correctly.

## Backend requirements before production

- Administrator authentication and authorization
- Restricted CORS origin matching the Vercel domain
- Server-side consent enforcement
- Rate limiting and audit logs for customer updates
- Input validation and normalized error responses
- HTTPS and secrets stored only on the server
- End-to-end test confirming the Android gateway receives a webhook and completes a test reply before live mode
