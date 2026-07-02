import { ApiError } from './errors.js';

const ALLOWED_BUCKET_PRICES = new Set([25, 30, 35]);
const PICKUP_LOCATION = 'Small Town Veggies Ovett';

function requiredText(value, field, maximumLength) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    throw new ApiError(422, 'VALIDATION_FAILED', 'The request contains invalid fields.', {
      fieldErrors: { [field]: `${field} is required.` },
    });
  }
  if (normalized.length > maximumLength) {
    throw new ApiError(422, 'VALIDATION_FAILED', 'The request contains invalid fields.', {
      fieldErrors: { [field]: `${field} must be ${maximumLength} characters or fewer.` },
    });
  }
  return normalized;
}

function optionalText(value, field, maximumLength) {
  if (value == null || value === '') return '';
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized.length > maximumLength) {
    throw new ApiError(422, 'VALIDATION_FAILED', 'The request contains invalid fields.', {
      fieldErrors: { [field]: `${field} must be ${maximumLength} characters or fewer.` },
    });
  }
  return normalized;
}

function normalizeUsPhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  const nationalNumber = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (!/^\d{10}$/.test(nationalNumber)) return null;
  return `+1${nationalNumber}`;
}

function validatePickupDate(value, now) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;

  const pickupTime = Date.parse(`${normalized}T00:00:00.000Z`);
  if (!Number.isFinite(pickupTime)) return null;

  const today = new Date(now);
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const maximum = todayUtc + 60 * 24 * 60 * 60 * 1000;
  if (pickupTime < todayUtc || pickupTime > maximum) return null;
  return normalized;
}

export function validateLogin(body) {
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!password || password.length > 512) {
    throw new ApiError(422, 'VALIDATION_FAILED', 'The request contains invalid fields.', {
      fieldErrors: { password: 'A valid password is required.' },
    });
  }
  return { password };
}

export function validateProduct(body) {
  const errors = {};
  let name;
  let unit;

  try {
    name = requiredText(body?.name, 'name', 80);
  } catch (error) {
    Object.assign(errors, error.fieldErrors);
  }

  try {
    unit = requiredText(body?.unit, 'unit', 40);
  } catch (error) {
    Object.assign(errors, error.fieldErrors);
  }

  const price = Number(body?.price);
  if (!Number.isFinite(price) || price < 0 || price > 10_000) {
    errors.price = 'price must be a number from 0 through 10000.';
  }

  if (Object.keys(errors).length) {
    throw new ApiError(422, 'VALIDATION_FAILED', 'The request contains invalid fields.', {
      fieldErrors: errors,
    });
  }

  return { name, unit, price: Math.round(price * 100) / 100 };
}

export function validateOrderSubmission(body, now = Date.now()) {
  const errors = {};
  let customerName;
  let notes;

  try {
    customerName = requiredText(body?.customer_name, 'customer_name', 120);
  } catch (error) {
    Object.assign(errors, error.fieldErrors);
  }

  try {
    notes = optionalText(body?.notes, 'notes', 500);
  } catch (error) {
    Object.assign(errors, error.fieldErrors);
  }

  const phone = normalizeUsPhone(body?.phone);
  if (!phone) errors.phone = 'Enter a valid 10-digit US phone number.';

  const bucketPrice = Number(body?.bucket_price);
  if (!ALLOWED_BUCKET_PRICES.has(bucketPrice)) {
    errors.bucket_price = 'Choose a $25, $30, or $35 vegetable bucket.';
  }

  const quantity = Number(body?.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 5) {
    errors.quantity = 'Quantity must be a whole number from 1 through 5.';
  }

  const pickupDate = validatePickupDate(body?.pickup_date, now);
  if (!pickupDate) {
    errors.pickup_date = 'Choose a valid pickup date within the next 60 days.';
  }

  if (Object.keys(errors).length) {
    throw new ApiError(422, 'VALIDATION_FAILED', 'The request contains invalid fields.', {
      fieldErrors: errors,
    });
  }

  const total = bucketPrice * quantity;
  return {
    customer_name: customerName,
    phone,
    items: [
      {
        name: 'Fresh Vegetable Bucket',
        quantity,
        unit_price: bucketPrice,
      },
    ],
    total,
    pickup_date: pickupDate,
    pickup_location: PICKUP_LOCATION,
    payment_status: 'unpaid',
    order_status: 'received',
    notes,
    created_at: new Date(now).toISOString(),
  };
}

export function validateIdempotencyKey(value) {
  const key = String(value ?? '').trim();
  if (key.length < 16 || key.length > 200) {
    throw new ApiError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'A valid Idempotency-Key header is required.');
  }
  return key;
}
