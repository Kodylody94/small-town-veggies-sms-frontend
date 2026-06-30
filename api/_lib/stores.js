import { ApiError } from './errors.js';

export class MemoryRateLimiter {
  constructor({ limit = 10, windowMs = 60_000, now = () => Date.now() } = {}) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
    this.entries = new Map();
  }

  async consume(key) {
    const currentTime = this.now();
    const existing = this.entries.get(key);
    const entry = !existing || existing.resetAt <= currentTime
      ? { count: 0, resetAt: currentTime + this.windowMs }
      : existing;

    entry.count += 1;
    this.entries.set(key, entry);

    if (entry.count > this.limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - currentTime) / 1000));
      throw new ApiError(429, 'RATE_LIMITED', 'Too many requests. Try again later.', {
        fieldErrors: { retry_after_seconds: String(retryAfterSeconds) },
      });
    }
  }
}

export class UnconfiguredRateLimiter {
  async consume() {
    throw new ApiError(503, 'RATE_LIMIT_STORE_NOT_CONFIGURED', 'A durable rate-limit store is required.', {
      expose: false,
    });
  }
}

export class MemoryIdempotencyStore {
  constructor() {
    this.entries = new Map();
  }

  async execute(key, operation) {
    if (!key) {
      throw new ApiError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'An Idempotency-Key header is required.');
    }
    if (this.entries.has(key)) return this.entries.get(key);
    const result = await operation();
    this.entries.set(key, result);
    return result;
  }
}

export class UnconfiguredIdempotencyStore {
  async execute() {
    throw new ApiError(503, 'IDEMPOTENCY_STORE_NOT_CONFIGURED', 'A durable idempotency store is required.', {
      expose: false,
    });
  }
}

export class ConsoleAuditStore {
  async write(entry) {
    console.info(JSON.stringify({ type: 'audit', ...entry }));
  }
}

export class MemoryAuditStore {
  constructor() {
    this.entries = [];
  }

  async write(entry) {
    this.entries.push(structuredClone(entry));
  }
}

export class UnconfiguredRepository {
  async listOrders() {
    throw new ApiError(503, 'DATABASE_NOT_CONFIGURED', 'The database adapter is not configured.', {
      expose: false,
    });
  }

  async listCustomers() {
    return this.listOrders();
  }

  async listProducts() {
    return this.listOrders();
  }

  async transitionOrder() {
    return this.listOrders();
  }

  async createProduct() {
    return this.listOrders();
  }
}

export class MemoryRepository {
  constructor({ orders = [], customers = [], products = [] } = {}) {
    this.orders = structuredClone(orders);
    this.customers = structuredClone(customers);
    this.products = structuredClone(products);
  }

  async listOrders() {
    return structuredClone(this.orders);
  }

  async listCustomers() {
    return structuredClone(this.customers);
  }

  async listProducts() {
    return structuredClone(this.products);
  }

  async transitionOrder(id, expectedStatus, nextStatus) {
    const order = this.orders.find((candidate) => String(candidate.id) === String(id));
    if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'The order was not found.');
    if (order.status !== expectedStatus) {
      throw new ApiError(409, 'INVALID_ORDER_TRANSITION', `The order cannot move from ${order.status} to ${nextStatus}.`);
    }
    order.status = nextStatus;
    order.updated_at = new Date().toISOString();
    return structuredClone(order);
  }

  async createProduct(product) {
    const created = {
      id: this.products.length ? Math.max(...this.products.map((item) => Number(item.id) || 0)) + 1 : 1,
      ...product,
      active: true,
    };
    this.products.push(created);
    return structuredClone(created);
  }
}
