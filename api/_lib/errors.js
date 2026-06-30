export class ApiError extends Error {
  constructor(status, code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = options.fieldErrors;
    this.expose = options.expose ?? status < 500;
  }
}

export function normalizeError(error) {
  if (error instanceof ApiError) return error;
  return new ApiError(500, 'INTERNAL_ERROR', 'An unexpected server error occurred.', {
    cause: error,
    expose: false,
  });
}
