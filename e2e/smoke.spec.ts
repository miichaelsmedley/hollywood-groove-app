import { test, expect, type Page } from '@playwright/test';

/**
 * Render smoke tests for the Hollywood Groove PWA.
 *
 * Every key route must boot and render without crashing: no uncaught page
 * error, and the app-wide ErrorBoundary fallback ("Something went wrong")
 * must never appear. These tests do NOT drive real sign-in or payment —
 * Firebase Auth, App Check and Stripe make that impractical to automate —
 * they verify each route reaches a sane rendered state, whether that is
 * content, a correct role-gate, or a handled error/empty state.
 */

const SANDBOX_SHOW = 'phase2_sandbox_show';

/** Begin collecting uncaught page errors, then navigate to `path`. */
async function gotoGuarded(page: Page, path: string): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  return errors;
}

/** Assert the app did not crash: no ErrorBoundary fallback, no page errors. */
async function expectNoCrash(page: Page, errors: string[]): Promise<void> {
  await expect(
    page.getByText('Something went wrong'),
    'the app-wide ErrorBoundary fallback should not be shown'
  ).toHaveCount(0);
  expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
}

/** Assert the Hollywood Groove app chrome (Layout header) rendered. */
async function expectAppShell(page: Page): Promise<void> {
  await expect(page.getByText('Hollywood Groove').first()).toBeVisible();
}

test('home route renders the app shell', async ({ page }) => {
  const errors = await gotoGuarded(page, '/');
  await expectAppShell(page);
  await expectNoCrash(page, errors);
});

test('door scanner renders and gates an anonymous visitor', async ({ page }) => {
  const errors = await gotoGuarded(page, '/scan');
  await expect(page.getByText('Door Scanner')).toBeVisible();
  // With no staff claims the page self-gates rather than 404-ing.
  await expect(
    page.getByRole('heading', { name: 'No scanner access' })
  ).toBeVisible();
  await expectNoCrash(page, errors);
});

test('public event page renders its standalone shell', async ({ page }) => {
  const errors = await gotoGuarded(page, `/event/${SANDBOX_SHOW}`);
  // The EventShell footer is present whether the show loads or the page
  // shows its "tickets aren't available" state — neither may crash.
  await expect(page.getByText('Secure checkout by Stripe')).toBeVisible();
  await expectNoCrash(page, errors);
});

test('tickets hub renders', async ({ page }) => {
  const errors = await gotoGuarded(page, '/tickets');
  await expectAppShell(page);
  await expectNoCrash(page, errors);
});

test('tickets success route renders', async ({ page }) => {
  const errors = await gotoGuarded(page, '/tickets/success');
  await expectAppShell(page);
  await expectNoCrash(page, errors);
});

test('tickets cancelled route renders', async ({ page }) => {
  const errors = await gotoGuarded(page, '/tickets/cancelled');
  await expectAppShell(page);
  await expectNoCrash(page, errors);
});

test('profile route renders', async ({ page }) => {
  const errors = await gotoGuarded(page, '/profile');
  await expectAppShell(page);
  await expectNoCrash(page, errors);
});

test('unknown route redirects to home', async ({ page }) => {
  const errors = await gotoGuarded(page, '/definitely-not-a-real-route');
  await expectAppShell(page);
  await expect(page).toHaveURL(/\/$/);
  await expectNoCrash(page, errors);
});
