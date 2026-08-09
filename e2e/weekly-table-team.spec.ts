import { expect, test, type Page } from '@playwright/test';

const EPISODE_PATH = '/weekly/blockbuster-movie-music-01';

const CORRECT_OPTIONS = [
  'Top Gun',
  'Footloose',
  'Back to the Future',
  '(I’ve Had) The Time of My Life',
  'Prince',
  'John Williams',
  'The Bodyguard',
  'Three',
  'Will Smith',
  'Aerosmith',
];

async function installShareCapture(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as Window & { __HG_WEEKLY_SHARE__?: string }).__HG_WEEKLY_SHARE__ = '';
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          (window as Window & { __HG_WEEKLY_SHARE__?: string }).__HG_WEEKLY_SHARE__ = value;
        },
      },
    });
  });
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installShareCapture(page);
});

test('a table shares one answer pad, restores its result and makes no Firebase calls', async ({ page }) => {
  const backendRequests: string[] = [];
  page.on('request', (request) => {
    const hostname = new URL(request.url()).hostname;
    if (
      hostname.endsWith('googleapis.com') ||
      hostname.endsWith('firebaseio.com') ||
      hostname.endsWith('firebasedatabase.app') ||
      hostname.endsWith('cloudfunctions.net') ||
      hostname.endsWith('firebaseapp.com')
    ) {
      backendRequests.push(request.url());
    }
  });

  await page.goto(EPISODE_PATH);
  await expect(page.getByRole('heading', { name: 'How are you playing?' })).toBeVisible();

  await page.getByRole('radio', { name: /Play as a team/ }).click();
  await page.getByLabel('Team name').fill('Quiztopher Walken');
  await page.getByRole('button', { name: 'Start the team quiz' }).click();

  await expect(page.getByRole('heading', { name: /Take My Breath Away/ })).toBeVisible();
  for (const [index, option] of CORRECT_OPTIONS.entries()) {
    await page.getByRole('button', { name: new RegExp(option.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).click();
    await page.getByRole('button', { name: 'Lock it in' }).click();
    if (index < CORRECT_OPTIONS.length - 1) {
      await page.getByRole('button', { name: 'Next' }).click();
    }
  }

  await page.getByRole('button', { name: 'See our score' }).click();
  await expect(page.locator('#weekly-result-heading')).toContainText('10/10');
  await expect(page.getByText('Quiztopher Walken').first()).toBeVisible();
  await expect(page.getByText('4 players, one shared answer pad')).toBeVisible();

  await page.getByRole('button', { name: 'Challenge another team' }).click();
  await expect.poll(() => page.evaluate(
    () => (window as Window & { __HG_WEEKLY_SHARE__?: string }).__HG_WEEKLY_SHARE__,
  )).toContain('Quiztopher Walken scored 10/10');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your result is ready' })).toBeVisible();
  await page.getByRole('button', { name: 'View result' }).click();
  await expect(page.locator('#weekly-result-heading')).toContainText('10/10');
  expect(backendRequests).toEqual([]);
});

test('challenge links open directly in team mode without extra setup fields for solo players', async ({ page }) => {
  await page.goto(`${EPISODE_PATH}?challenge=The%20Couch%20Potatoes`);
  await expect(page.getByText('The Couch Potatoes').first()).toBeVisible();
  await expect(page.getByRole('radio', { name: /Play as a team/ })).toHaveAttribute('aria-checked', 'true');

  await page.getByRole('radio', { name: /Play solo/ }).click();
  await expect(page.getByLabel('Team name')).toHaveCount(0);
  await page.getByRole('button', { name: 'Start playing' }).click();
  await expect(page.getByText('Question 1 of 10')).toBeVisible();
});

test('the video clock closes revealed questions even after switching to the TV answer pad', async ({ page }) => {
  await page.goto(`${EPISODE_PATH}?playerFixture=1`);
  await page.getByRole('button', { name: 'Start playing' }).click();

  await page.getByRole('button', { name: 'Q1 opens' }).click();
  await page.getByRole('button', { name: 'Top Gun' }).click();
  await expect(page.getByRole('button', { name: 'Lock it in' })).toBeEnabled();

  await page.getByRole('button', { name: 'Q1 reveals' }).click();
  await expect(page.getByRole('button', { name: 'Lock it in' })).toHaveCount(0);
  await expect(page.getByText('Time is up. This question was left unanswered.')).toBeVisible();

  await page.getByRole('radio', { name: 'Video on the TV' }).click();
  await expect(page.getByRole('button', { name: 'Lock it in' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Top Gun' })).toBeDisabled();
});

test('seeking backwards never reopens answers and the final score waits for the last reveal', async ({ page }) => {
  await page.goto(`${EPISODE_PATH}?playerFixture=1`);
  await page.getByRole('button', { name: 'Start playing' }).click();

  await page.getByRole('button', { name: 'Q10 opens' }).click();
  await expect(page.getByText('Question 10 of 10')).toBeVisible();
  await page.getByRole('button', { name: 'Aerosmith' }).click();
  await page.getByRole('button', { name: 'Lock it in' }).click();
  await expect(page.getByRole('button', { name: 'Finish and see our score' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Rewind to Q1' }).click();
  await expect(page.getByText('Question 1 of 10')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lock it in' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Q10 reveals' }).click();
  await expect(page.getByRole('button', { name: 'Finish and see our score' })).toBeVisible();
  await page.getByRole('button', { name: 'Finish and see our score' }).click();
  await expect(page.locator('#weekly-result-heading')).toContainText('1/10');
});

test('blocked browser storage warns the player but does not stop the quiz', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Storage is blocked', 'QuotaExceededError');
    };
  });

  await page.goto(EPISODE_PATH);
  await page.getByRole('button', { name: 'Start playing' }).click();
  await expect(page.getByText(/this browser is blocking saved progress/i)).toBeVisible();

  await page.getByRole('button', { name: 'Top Gun' }).click();
  await page.getByRole('button', { name: 'Lock it in' }).click();
  await expect(page.getByText('Locked in')).toBeVisible();
});
