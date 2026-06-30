const ORDER_STATUSES = new Set(['pending', 'confirmed', 'ready', 'picked_up']);

function requireRecord(value, label, index) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`The backend returned an invalid ${label} record at position ${index + 1}.`);
  }
  return value;
}

function requireId(record, label, index) {
  const id = record.id;
  if ((typeof id !== 'string' && typeof id !== 'number') || !String(id).trim()) {
    throw new Error(`The backend returned a ${label} record without a valid ID at position ${index + 1}.`);
  }
  return id;
}

function optionalText(value, maxLength = 300) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function optionalMoney(value) {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function normalizeOrder(value, index = 0) {
  const record = requireRecord(value, 'order', index);
  const rawStatus = optionalText(record.status, 40).toLowerCase();

  return {
    ...record,
    id: requireId(record, 'order', index),
    customer_name: optionalText(record.customer_name, 120),
    pickup_day: optionalText(record.pickup_day, 40),
    status: ORDER_STATUSES.has(rawStatus) ? rawStatus : 'unknown',
    total: optionalMoney(record.total),
    created_at: optionalText(record.created_at, 80),
    submitted_at: optionalText(record.submitted_at, 80),
    updated_at: optionalText(record.updated_at, 80),
  };
}

export function normalizeCustomer(value, index = 0) {
  const record = requireRecord(value, 'customer', index);
  const consentState =
    record.opted_in === true ? 'opted_in' : record.opted_in === false ? 'opted_out' : 'unknown';

  return {
    ...record,
    id: requireId(record, 'customer', index),
    name: optionalText(record.name, 120),
    phone: optionalText(record.phone, 40),
    opted_in: consentState === 'opted_in',
    consent_state: consentState,
    created_at: optionalText(record.created_at, 80),
  };
}

export function normalizeProduct(value, index = 0) {
  const record = requireRecord(value, 'product', index);
  const availabilityState =
    record.active === true ? 'available' : record.active === false ? 'unavailable' : 'unknown';

  return {
    ...record,
    id: requireId(record, 'product', index),
    name: optionalText(record.name, 120),
    price: optionalMoney(record.price),
    unit: optionalText(record.unit, 60),
    active: availabilityState === 'available',
    availability_state: availabilityState,
  };
}

export function normalizeCollection(payload, label, normalizer) {
  if (!Array.isArray(payload)) {
    throw new Error(`The backend returned an invalid ${label} response.`);
  }
  return payload.map((record, index) => normalizer(record, index));
}
