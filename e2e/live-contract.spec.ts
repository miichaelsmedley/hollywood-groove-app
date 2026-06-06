import { test, expect, type Page } from '@playwright/test';

type LastResponse = {
  path: string;
  payload: Record<string, unknown>;
};

async function readLastResponse(page: Page): Promise<LastResponse> {
  await expect
    .poll(async () => page.evaluate(() => Boolean((window as any).__HG_LAST_RESPONSE__)))
    .toBe(true);

  return page.evaluate(() => (window as any).__HG_LAST_RESPONSE__);
}

test.describe('live trivia response contracts', () => {
  test('submits multi-choice payloads', async ({ page }) => {
    await page.goto('/shows/101/trivia?test=true&fixture=multi');
    await expect(page.getByRole('heading', { name: 'Which band sang Bohemian Rhapsody?' })).toBeVisible();

    await page.getByRole('button', { name: /Queen/ }).click();

    const response = await readLastResponse(page);
    expect(response.path).toBe('test/shows/101/responses/fixture-trivia-multi/e2e-user');
    expect(response.payload).toMatchObject({
      optionIndex: 0,
      displayName: 'Fixture Fan',
    });
    expect(response.payload).toHaveProperty('answeredAt');
    expect(response.payload).toHaveProperty('responseTime');
  });

  test('submits boolean payloads', async ({ page }) => {
    await page.goto('/shows/101/trivia?test=true&fixture=boolean');

    await page.getByRole('button', { name: 'True' }).click();

    const response = await readLastResponse(page);
    expect(response.payload).toMatchObject({
      booleanValue: true,
      displayName: 'Fixture Fan',
    });
    expect(response.payload).toHaveProperty('answeredAt');
    expect(response.payload).toHaveProperty('responseTime');
  });

  test('submits freeform payloads', async ({ page }) => {
    await page.goto('/shows/101/trivia?test=true&fixture=freeform');

    await page.locator('textarea[placeholder^="Type your answer"]').fill('Freddie Mercury');
    await page.getByRole('button', { name: 'Submit Answer' }).click();

    const response = await readLastResponse(page);
    expect(response.payload).toMatchObject({
      text: 'Freddie Mercury',
      displayName: 'Fixture Fan',
    });
    expect(response.payload).toHaveProperty('answeredAt');
    expect(response.payload).toHaveProperty('responseTime');
  });

  test('submits scale payloads', async ({ page }) => {
    await page.goto('/shows/101/trivia?test=true&fixture=scale');

    const slider = page.locator('input[type="range"]');
    await slider.evaluate((node) => {
      const input = node as HTMLInputElement;
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      valueSetter?.call(input, '7');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect(page.getByText('7')).toBeVisible();
    await page.getByRole('button', { name: 'Submit Rating' }).click();

    const response = await readLastResponse(page);
    expect(response.payload).toMatchObject({
      scaleValue: 7,
      displayName: 'Fixture Fan',
    });
    expect(response.payload).toHaveProperty('answeredAt');
    expect(response.payload).toHaveProperty('responseTime');
  });
});

test.describe('live activity response contracts', () => {
  test('submits dancing claims', async ({ page }) => {
    await page.goto('/shows/101/activity?test=true&fixture=dancing');

    await page.getByRole('button', { name: /Claim/ }).click();

    const response = await readLastResponse(page);
    expect(response.path).toBe('test/shows/101/responses/fixture-activity-dancing/e2e-user');
    expect(response.payload).toMatchObject({
      type: 'dance_claim',
      displayName: 'Fixture Fan',
    });
    expect(response.payload).toHaveProperty('claimedAt');
  });

  test('submits votes', async ({ page }) => {
    await page.goto('/shows/101/activity?test=true&fixture=vote');

    await page.getByRole('button', { name: /Dancing Queen/ }).click();

    const response = await readLastResponse(page);
    expect(response.payload).toMatchObject({
      optionIndex: 0,
      optionText: 'Dancing Queen',
      displayName: 'Fixture Fan',
    });
    expect(response.payload).toHaveProperty('votedAt');
  });

  for (const fixture of [
    'sing_signup',
    'backup_singer',
    'stage_participation',
    'costume_contest',
    'competition',
    'raffle',
  ]) {
    test(`submits join payloads for ${fixture}`, async ({ page }) => {
      await page.goto(`/shows/101/activity?test=true&fixture=${fixture}`);

      await page.getByRole('button', { name: 'Join Activity' }).click();

      const response = await readLastResponse(page);
      expect(response.path).toBe(`test/shows/101/responses/fixture-activity-${fixture}/e2e-user`);
      expect(response.payload).toMatchObject({
        action: 'join',
        displayName: 'Fixture Fan',
      });
      expect(response.payload).toHaveProperty('joinedAt');
    });
  }
});
