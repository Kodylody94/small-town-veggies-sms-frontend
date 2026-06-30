BEGIN;

CREATE TABLE IF NOT EXISTS administrators (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  login_name TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'manager', 'viewer')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  administrator_id BIGINT REFERENCES administrators(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS admin_sessions_active_idx
  ON admin_sessions (expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS customers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  phone_e164 TEXT UNIQUE,
  opted_in BOOLEAN NOT NULL DEFAULT FALSE,
  consent_source TEXT NOT NULL DEFAULT 'unknown'
    CHECK (consent_source IN ('web', 'sms', 'paper', 'staff', 'unknown')),
  consent_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);

CREATE INDEX IF NOT EXISTS customers_opted_in_idx
  ON customers (opted_in)
  WHERE opted_in = TRUE;

CREATE TABLE IF NOT EXISTS products (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  price_cents INTEGER NOT NULL CHECK (price_cents BETWEEN 0 AND 1000000),
  unit TEXT NOT NULL CHECK (char_length(unit) BETWEEN 1 AND 40),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS products_active_idx
  ON products (active, name);

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'ready', 'picked_up')),
  pickup_day TEXT CHECK (pickup_day IS NULL OR char_length(pickup_day) <= 40),
  total_cents INTEGER NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  submitted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  picked_up_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS orders_status_created_idx
  ON orders (status, created_at DESC);

CREATE INDEX IF NOT EXISTS orders_customer_idx
  ON orders (customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
  product_name_snapshot TEXT NOT NULL CHECK (char_length(product_name_snapshot) BETWEEN 1 AND 120),
  unit_snapshot TEXT NOT NULL CHECK (char_length(unit_snapshot) BETWEEN 1 AND 60),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  quantity NUMERIC(10, 3) NOT NULL CHECK (quantity > 0),
  line_total_cents INTEGER NOT NULL CHECK (line_total_cents >= 0)
);

CREATE INDEX IF NOT EXISTS order_items_order_idx
  ON order_items (order_id);

CREATE TABLE IF NOT EXISTS idempotency_records (
  key TEXT PRIMARY KEY CHECK (char_length(key) BETWEEN 16 AND 200),
  actor_subject TEXT NOT NULL,
  route TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  response_status INTEGER,
  response_body JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL,
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idempotency_records_expiry_idx
  ON idempotency_records (expires_at);

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  key TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  window_started_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  CHECK (expires_at > window_started_at)
);

CREATE INDEX IF NOT EXISTS rate_limit_buckets_expiry_idx
  ON rate_limit_buckets (expires_at);

CREATE TABLE IF NOT EXISTS audit_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id UUID NOT NULL,
  administrator_id BIGINT REFERENCES administrators(id) ON DELETE SET NULL,
  actor_subject TEXT NOT NULL,
  operation TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure', 'denied')),
  error_code TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS audit_events_created_idx
  ON audit_events (created_at DESC);

CREATE INDEX IF NOT EXISTS audit_events_actor_idx
  ON audit_events (actor_subject, created_at DESC);

COMMIT;
