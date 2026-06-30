const MAX_PRODUCT_NAME_LENGTH = 80;
const MAX_UNIT_LENGTH = 40;
const MAX_PRICE = 10_000;

export function validateProductForm(form) {
  const name = String(form?.name ?? '').trim();
  const unit = String(form?.unit ?? '').trim();
  const rawPrice = form?.price;
  const price = Number(rawPrice);
  const errors = {};

  if (!name) errors.name = 'Enter a product name.';
  else if (name.length > MAX_PRODUCT_NAME_LENGTH) {
    errors.name = `Use ${MAX_PRODUCT_NAME_LENGTH} characters or fewer.`;
  }

  if (!unit) errors.unit = 'Enter a unit such as bucket, pound, or dozen.';
  else if (unit.length > MAX_UNIT_LENGTH) {
    errors.unit = `Use ${MAX_UNIT_LENGTH} characters or fewer.`;
  }

  if (rawPrice === '' || rawPrice === null || rawPrice === undefined) {
    errors.price = 'Enter a price.';
  } else if (!Number.isFinite(price) || price < 0 || price > MAX_PRICE) {
    errors.price = `Enter a price from $0 to $${MAX_PRICE.toLocaleString('en-US')}.`;
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
    value: { name, unit, price },
  };
}
