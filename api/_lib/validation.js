import { ApiError } from './errors.js';

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

export function validateIdempotencyKey(value) {
  const key = String(value ?? '').trim();
  if (key.length < 16 || key.length > 200) {
    throw new ApiError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'A valid Idempotency-Key header is required.');
  }
  return key;
}
