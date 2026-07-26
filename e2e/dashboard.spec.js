import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { expect, test } = require('@playwright/test');

const API_ORIGIN = 'https://api.small-town-veggies.test';
const APP_ORIGIN = 'http://127.0.0.1:4173';

const administratorSession = {
  authenticated: true,
  administrator_id: 'owner',
  csrf_token: 'csrf-test-token-that-is-long-enough',
  expires_at: '2026-07-01T12:00:00Z',
};

const defaultPayloads = {
  '/api/auth/session': { data: administratorSession },
  '/api/auth/login': { data: administratorSession },
  '/api/auth/logout': { data: { authenticated: false } },
  '/api/orders': [
    {
      id: 99,
      customer_name: 'Older Order',
      pickup_day: 'Thursday',
      status: 'pending',
      total: 30,
      created_at: '2026-06-01T10:00:00Z',
    },
    {
      id: 2,
      customer_name: 'Newest Order',
      pickup_day: 'Friday',
      status: 'confirmed',
      total: 25,
      created_at: '2026-06-30T10:00:00Z',
    },
  ],
  '/api/customers': [
    {
      id: 1,
      name: 'Allowed Customer',
      phone: '+16015550100',
      opted_in: true,
      created_at: '2026-06-01',
    },
    {
      id: 2,
      name: 'Ambiguous Customer',
      phone: '+16015550101',
      opted_in: 'false',
      created_at: '2026-06-02',
    },
  ],
  '/api/products': [
    { id: 1, name: 'Tomatoes', price: 25, unit: 'bucket', active: true },
    { id: 2, name: 'Unknown Peas', price: 20, unit: 'bucket', active: 'true' },
  ],
};

async function mockApi(page, overrides = {}) {
  await page.route(`${API_ORIGIN}/api/**`, async (route) => {
    const request = route.request();
    const method = request.method();
    const pathname = new URL(request.url()).pathname;

    if (method === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': APP_ORIGIN,
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers':
            'Content-Type, X-Small-Town-Veggies-Request, X-CSRF-Token, Idempotency-Key',
        },
      });
      return;
    }

    const configured = overrides[`${method} ${pathname}`] ?? overrides[pathname];
    const response = configured ?? { status: 200, body: defaultPayloads[pathname] ?? [] };

    await route.fulfill({
      status: response.status ?? 200,
      headers: {
        'Access-Control-Allow-Origin': APP_ORIGIN,
        'Access-Control-Allow-Credentials': 'true',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(response.body ?? response),
    });
  });
}

test('requires an administrator session and returns to the requested page after login', async ({ page }) => {
  await mockApi(page, {
    'GET /api/auth/session': {
      status: 401,
      body: { message: 'A valid administrator session is required.', code: 'ADMINISTRATOR_SESSION_REQUIRED' },
    },
  });

  await page.goto('/orders');
  await expect(page.getByRole('heading', { name: 'Administrator sign in' })).toBeVisible();

  await page.getByLabel('Administrator password').fill('a-valid-test-password');
  await page.getByRole('button', { name: 'Sign in securely' }).click();

  await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible();
  await expect(page).toHaveURL(/\/orders$/);
});

test('renders protected read-only data and sorts recent orders by timestamp', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');

  await expect(page.getByText('Live data is connected in read-only mode.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.locator('article').filter({ hasText: 'Active products' })).toContainText('1');

  const firstRecentOrder = page.locator('tbody tr').first();
  await expect(firstRecentOrder).toContainText('#2');
  await expect(firstRecentOrder).toContainText('Newest Order');

  await page.goto('/orders');
  await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toBeDisabled();
});

test('fails closed for ambiguous consent and product availability', async ({ page }) => {
  await mockApi(page);

  await page.goto('/customers');
  const ambiguousCustomer = page.locator('tr').filter({ hasText: 'Ambiguous Customer' });
  await expect(ambiguousCustomer).toContainText('Unknown — do not message');

  await page.goto('/products');
  const ambiguousProduct = page.locator('tr').filter({ hasText: 'Unknown Peas' });
  await expect(ambiguousProduct).toContainText('Unknown — unavailable');
});

test('returns to sign in when a protected API request reports an expired session', async ({ page }) => {
  await mockApi(page, {
    '/api/orders': {
      status: 401,
      body: {
        message: 'Your administrator session has expired.',
        code: 'SESSION_EXPIRED',
      },
    },
  });

  await page.goto('/orders');
  await expect(page.getByRole('heading', { name: 'Administrator sign in' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Your administrator session has expired.');
});

test('signs out through the protected backend session endpoint', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Administrator sign in' })).toBeVisible();
});

test('contains mobile navigation focus and restores it after closing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  await page.goto('/');

  const openButton = page.getByRole('button', { name: 'Open navigation' });
  const firstNavigationLink = page.locator('#primary-navigation a').first();

  await expect(firstNavigationLink).toBeHidden();
  await page.keyboard.press('Tab');
  await expect(openButton).toBeFocused();

  await openButton.click();

  const navigation = page.getByRole('dialog', { name: 'Primary navigation' });
  await expect(navigation).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close navigation', exact: true })).toBeFocused();

  const contentIsInert = await page.locator('main').evaluate((element) => element.parentElement.inert);
  expect(contentIsInert).toBe(true);

  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(firstNavigationLink).toBeHidden();
  await expect(openButton).toBeFocused();

  const contentIsInteractive = await page.locator('main').evaluate((element) => !element.parentElement.inert);
  expect(contentIsInteractive).toBe(true);
});
