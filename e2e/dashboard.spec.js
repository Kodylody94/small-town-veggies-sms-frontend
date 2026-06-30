import { expect, test } from '@playwright/test';

const API_ORIGIN = 'https://api.small-town-veggies.test';
const APP_ORIGIN = 'http://127.0.0.1:4173';

const defaultPayloads = {
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
    const pathname = new URL(route.request().url()).pathname;
    const configured = overrides[pathname];
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
  await expect(page.getByRole('button', { name: 'Confirm' })).toBeDisabled();
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

test('surfaces normalized API authorization errors', async ({ page }) => {
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
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Could not load orders');
  await expect(alert).toContainText('Your administrator session has expired.');
});

test('contains mobile navigation focus and restores it after closing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  await page.goto('/');

  const openButton = page.getByRole('button', { name: 'Open navigation' });
  await openButton.click();

  const navigation = page.getByRole('dialog', { name: 'Primary navigation' });
  await expect(navigation).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close navigation' })).toBeFocused();

  const contentIsInert = await page.locator('main').evaluate((element) => element.parentElement.inert);
  expect(contentIsInert).toBe(true);

  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('link', { name: 'Reminders' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(openButton).toBeFocused();

  const contentIsInteractive = await page.locator('main').evaluate((element) => !element.parentElement.inert);
  expect(contentIsInteractive).toBe(true);
});
