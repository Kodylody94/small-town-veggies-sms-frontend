import { ApiError } from './errors.js';

const ALLOWED_BUCKET_PRICES = new Set([25, 30, 35]);
const PICKUP_LOCATION = 'Small Town Veggies Ovett';
const BUSINESS_TIME_ZONE = 'America/Chicago';
const DAY_MS = 24 * 60 * 60 * 1000;

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

function parseDateOnly(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { value: normalized, timestamp };
}

function businessDateOnly(now) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date(now))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function validatePickupDate(value, now) {
  const pickup = parseDateOnly(value);
  const today = parseDateOnly(businessDateOnly(now));
  if (!pickup || !today) return null;

  const difference = pickup.timestamp - today.timestamp;
  if (difference < 0 || difference > 60 * DAY_MS || difference % DAY_MS !== 0) return null;
  return pickup.value;
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

  const price = typeof body?.price === 'number' ? body.price : Number.NaN;
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
    errors.pickup_date = 'Choose a valid pickup date within the next 60 days in America/Chicago.';
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
